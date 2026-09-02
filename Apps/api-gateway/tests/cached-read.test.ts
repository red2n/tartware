/**
 * Cached availability and rate reads.
 *
 * These sit on the highest-volume path in the system, so the failures worth
 * guarding are the quiet ones: an entry shared between tenants (a cross-tenant
 * leak, not a stale read), a cached error that turns a blip into a sticky
 * outage, and a stale rate served after the operator changed it.
 */

import { describe, expect, it, vi } from "vitest";

const proxyRequest = vi.fn();
const sendUpstream = vi.fn((reply: unknown) => reply);

vi.mock("../src/utils/proxy.js", () => ({
  proxyRequest: (...args: unknown[]) => proxyRequest(...args),
  sendUpstream: (...args: unknown[]) => sendUpstream(...args),
}));

vi.mock("../src/config.js", () => ({
  cachedReadConfig: { enabled: true, availabilityTtlMs: 2000, ratesTtlMs: 30000, maxEntries: 100 },
  serviceTargets: { roomsServiceUrl: "http://rooms" },
}));

vi.mock("../src/logger.js", () => ({
  gatewayLogger: { child: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }) },
}));

const { createCachedRead } = await import("../src/utils/cached-read.js");

const OK = { status: 200, headers: [] as Array<[string, string]>, body: Buffer.from("[]") };

/** A request as the handler reads it: raw url for the key, query for the tenant. */
const requestFor = (url: string, tenantId?: string) =>
  ({ raw: { url }, query: tenantId ? { tenant_id: tenantId } : {} }) as never;

const replyStub = () => {
  const reply = { header: vi.fn(() => reply), status: vi.fn(() => reply), send: vi.fn(() => reply) };
  return reply as never;
};

const build = () =>
  createCachedRead({
    name: "test",
    ttlMs: 2000,
    maxSize: 100,
    targetBaseUrl: () => "http://rooms",
  });

describe("createCachedRead", () => {
  it("serves a repeat request without going upstream", async () => {
    proxyRequest.mockReset();
    proxyRequest.mockImplementation(async (_req, reply, _url, onResponse) => {
      onResponse?.(OK);
      return reply;
    });
    const cached = build();
    const url = "/v1/rates?tenant_id=t1&property_id=p1";

    await cached.handler(requestFor(url, "t1"), replyStub());
    await cached.handler(requestFor(url, "t1"), replyStub());

    expect(proxyRequest).toHaveBeenCalledTimes(1);
  });

  it("never shares an entry between tenants", async () => {
    // The response is tenant-scoped; reusing it across tenants would be a
    // cross-tenant data leak, which is why the tenant is part of every key.
    proxyRequest.mockReset();
    proxyRequest.mockImplementation(async (_req, reply, _url, onResponse) => {
      onResponse?.(OK);
      return reply;
    });
    const cached = build();

    await cached.handler(requestFor("/v1/rates?tenant_id=t1", "t1"), replyStub());
    await cached.handler(requestFor("/v1/rates?tenant_id=t2", "t2"), replyStub());

    expect(proxyRequest).toHaveBeenCalledTimes(2);
  });

  it("treats different query parameters as different questions", async () => {
    proxyRequest.mockReset();
    proxyRequest.mockImplementation(async (_req, reply, _url, onResponse) => {
      onResponse?.(OK);
      return reply;
    });
    const cached = build();

    await cached.handler(
      requestFor("/v1/rooms/availability?tenant_id=t1&check_in_date=2026-11-01", "t1"),
      replyStub(),
    );
    await cached.handler(
      requestFor("/v1/rooms/availability?tenant_id=t1&check_in_date=2026-11-05", "t1"),
      replyStub(),
    );

    expect(proxyRequest).toHaveBeenCalledTimes(2);
  });

  it("keys independently of parameter order", async () => {
    proxyRequest.mockReset();
    proxyRequest.mockImplementation(async (_req, reply, _url, onResponse) => {
      onResponse?.(OK);
      return reply;
    });
    const cached = build();

    await cached.handler(requestFor("/v1/rates?tenant_id=t1&property_id=p1", "t1"), replyStub());
    await cached.handler(requestFor("/v1/rates?property_id=p1&tenant_id=t1", "t1"), replyStub());

    expect(proxyRequest).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed read", async () => {
    // Caching a 502 would turn one bad upstream moment into a sticky failure
    // for every caller until the entry expired.
    proxyRequest.mockReset();
    proxyRequest.mockImplementation(async (_req, reply, _url, onResponse) => {
      onResponse?.({ status: 502, headers: [], body: Buffer.from("") });
      return reply;
    });
    const cached = build();
    const url = "/v1/rates?tenant_id=t1";

    await cached.handler(requestFor(url, "t1"), replyStub());
    await cached.handler(requestFor(url, "t1"), replyStub());

    expect(proxyRequest).toHaveBeenCalledTimes(2);
  });

  it("drops a tenant's entries when that tenant writes", async () => {
    proxyRequest.mockReset();
    proxyRequest.mockImplementation(async (_req, reply, _url, onResponse) => {
      onResponse?.(OK);
      return reply;
    });
    const cached = build();
    const url = "/v1/rates?tenant_id=t1";

    await cached.handler(requestFor(url, "t1"), replyStub());
    cached.invalidateTenant("t1");
    await cached.handler(requestFor(url, "t1"), replyStub());

    expect(proxyRequest).toHaveBeenCalledTimes(2);
  });

  it("leaves other tenants cached when one is invalidated", async () => {
    proxyRequest.mockReset();
    proxyRequest.mockImplementation(async (_req, reply, _url, onResponse) => {
      onResponse?.(OK);
      return reply;
    });
    const cached = build();

    await cached.handler(requestFor("/v1/rates?tenant_id=t1", "t1"), replyStub());
    await cached.handler(requestFor("/v1/rates?tenant_id=t2", "t2"), replyStub());
    cached.invalidateTenant("t1");
    await cached.handler(requestFor("/v1/rates?tenant_id=t2", "t2"), replyStub());

    // t2 was served from cache the second time: 2 upstream calls, not 3.
    expect(proxyRequest).toHaveBeenCalledTimes(2);
  });

  it("bypasses the cache entirely when no tenant is present", async () => {
    // Without a tenant there is no safe key, so the request must go upstream
    // rather than share an entry.
    proxyRequest.mockReset();
    proxyRequest.mockImplementation(async (_req, reply) => reply);
    const cached = build();

    await cached.handler(requestFor("/v1/rates"), replyStub());
    await cached.handler(requestFor("/v1/rates"), replyStub());

    expect(proxyRequest).toHaveBeenCalledTimes(2);
    // And it is proxied plainly, with no response observer to cache with.
    expect(proxyRequest.mock.calls[0]).toHaveLength(3);
  });
});
