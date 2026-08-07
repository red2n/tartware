import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/metrics.js", () => ({
  proxyDurationHistogram: { observe: vi.fn() },
}));

vi.mock("../src/utils/circuit-breaker.js", () => ({
  getCircuitBreaker: () => ({
    allowRequest: async () => true,
    recordFailure: async () => undefined,
    recordSuccess: async () => undefined,
    getState: async () => "closed",
  }),
}));

import { proxyRequest } from "../src/utils/proxy.js";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

const fetchMock = vi.fn(
  async () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
);

/** Headers the gateway actually put on the wire for the last proxied call. */
const forwardedHeaders = (): Headers => {
  const call = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return call[1].headers as Headers;
};

const buildRequest = (options: {
  headers: Record<string, string>;
  authorizedTenantIds?: Set<string>;
}) =>
  ({
    method: "GET",
    url: "/guests",
    raw: { url: "/guests" },
    headers: options.headers,
    body: undefined,
    auth: options.authorizedTenantIds
      ? { authorizedTenantIds: options.authorizedTenantIds }
      : undefined,
    log: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
  }) as never;

const buildReply = () => {
  const reply = {
    status: vi.fn(() => reply),
    header: vi.fn(() => reply),
    send: vi.fn(() => reply),
  };
  return reply as never;
};

describe("proxy header sanitization", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("replaces a client-supplied tenant header with the JWT-verified tenant", async () => {
    await proxyRequest(
      buildRequest({
        headers: { "x-tartware-tenant-id": TENANT_B },
        authorizedTenantIds: new Set([TENANT_A]),
      }),
      buildReply(),
      "http://guests-service:3010",
    );

    expect(forwardedHeaders().get("x-tartware-tenant-id")).toBe(TENANT_A);
  });

  it("drops a spoofed tenant header when the caller has no tenant scope", async () => {
    // Regression: the gateway used to copy every inbound header through and
    // only *overwrite* the tenant header when exactly one tenant was
    // authorized. With zero authorized tenants the client's own value
    // survived, and downstream services trust this header in place of the
    // query parameter — a cross-tenant read/write for any authenticated user.
    await proxyRequest(
      buildRequest({ headers: { "x-tartware-tenant-id": TENANT_B } }),
      buildReply(),
      "http://guests-service:3010",
    );

    expect(forwardedHeaders().has("x-tartware-tenant-id")).toBe(false);
  });

  it("drops a spoofed tenant header when the caller spans several tenants", async () => {
    await proxyRequest(
      buildRequest({
        headers: { "x-tartware-tenant-id": TENANT_B },
        authorizedTenantIds: new Set([TENANT_A, TENANT_B]),
      }),
      buildReply(),
      "http://guests-service:3010",
    );

    expect(forwardedHeaders().has("x-tartware-tenant-id")).toBe(false);
  });

  it("strips any header under the reserved internal prefix", async () => {
    await proxyRequest(
      buildRequest({
        headers: {
          "x-tartware-caller": "billing-service",
          "x-tartware-anything": "attacker-controlled",
        },
        authorizedTenantIds: new Set([TENANT_A]),
      }),
      buildReply(),
      "http://guests-service:3010",
    );

    const headers = forwardedHeaders();
    expect(headers.has("x-tartware-caller")).toBe(false);
    expect(headers.has("x-tartware-anything")).toBe(false);
  });

  it("strips a forged mTLS identity header", async () => {
    // Envoy sanitises XFCC on ingress, but the gateway does not rely on that
    // staying configured correctly.
    await proxyRequest(
      buildRequest({
        headers: {
          "x-forwarded-client-cert":
            'URI=spiffe://cluster.local/ns/tartware-system/sa/api-gateway;Subject=""',
        },
        authorizedTenantIds: new Set([TENANT_A]),
      }),
      buildReply(),
      "http://guests-service:3010",
    );

    expect(forwardedHeaders().has("x-forwarded-client-cert")).toBe(false);
  });

  it("still forwards ordinary headers", async () => {
    await proxyRequest(
      buildRequest({
        headers: {
          authorization: "Bearer token-value",
          "x-request-id": "req-123",
          accept: "application/json",
        },
        authorizedTenantIds: new Set([TENANT_A]),
      }),
      buildReply(),
      "http://guests-service:3010",
    );

    const headers = forwardedHeaders();
    expect(headers.get("authorization")).toBe("Bearer token-value");
    expect(headers.get("x-request-id")).toBe("req-123");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("does not forward hop-by-hop headers", async () => {
    await proxyRequest(
      buildRequest({
        headers: { host: "api.tartware.local", connection: "keep-alive" },
        authorizedTenantIds: new Set([TENANT_A]),
      }),
      buildReply(),
      "http://guests-service:3010",
    );

    const headers = forwardedHeaders();
    expect(headers.has("host")).toBe(false);
    expect(headers.has("connection")).toBe(false);
  });
});
