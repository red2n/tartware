import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Disable Redis before config loads so rate-limiter uses in-memory store
vi.hoisted(() => {
  process.env.REDIS_ENABLED = "false";
});

import { buildServer } from "../src/server.js";
import { kafkaConfig, serviceTargets } from "../src/config.js";

const { submitCommandMock, proxyRequestMock } = vi.hoisted(() => {
  return {
    submitCommandMock: vi.fn(async ({ reply }) => {
      reply.status(202).send({
        status: "accepted",
        command_id: "00000000-0000-0000-0000-000000000001",
        command_name: "test.command",
        accepted_at: new Date().toISOString(),
      });
    }),
    proxyRequestMock: vi.fn(async (_request, reply, targetUrl) => {
      reply.send({ proxied: true, targetUrl });
    }),
  };
});

vi.mock("../src/utils/command-publisher.js", () => ({
  submitCommand: submitCommandMock,
}));

vi.mock("../src/utils/proxy.js", () => ({
  proxyRequest: proxyRequestMock,
}));

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(async () => ({ rows: [{ "?column?": 1 }] })),
  withTransaction: vi.fn(async (fn: (q: unknown) => Promise<unknown>) => fn(vi.fn(async () => ({ rows: [] })))),
  pool: { end: vi.fn() },
}));

vi.mock("../src/services/membership-service.js", () => ({
  getUserMemberships: vi.fn(async () => [
    {
      tenantId: "11111111-1111-1111-1111-111111111111",
      tenantName: "Demo Hotel",
      role: "MANAGER",
      isActive: true,
      permissions: {},
      modules: ["core"],
    },
  ]),
}));

vi.mock("../src/lib/jwt.js", () => ({
  extractBearerToken: (header?: string) => header?.split(" ")[1] ?? null,
  verifyAccessToken: vi.fn(() => ({ sub: "user-1", scope: ["SYSTEM_ADMIN"] })),
}));

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
vi.stubGlobal("fetch", fetchMock);

describe("API Gateway server", () => {
  let app: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  beforeEach(() => {
    fetchMock.mockClear();
    submitCommandMock.mockClear();
    proxyRequestMock.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: expect.any(String),
    });
  });

  it("reports readiness with kafka cluster summary", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: expect.any(String),
      checks: {
        database: { status: "ok" },
        kafka: { status: expect.any(String) },
        coreService: { status: expect.any(String) },
      },
    });
  });

  it("forwards reservation creates through submitCommand", async () => {
    const tenantId = "11111111-1111-1111-1111-111111111111";
    const response = await app.inject({
      method: "POST",
      url: `/v1/tenants/${tenantId}/reservations`,
      payload: {
        reservation_id: "resv-1",
        guest_id: "guest-1",
      },
      headers: {
        authorization: "Bearer unit-test-token",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(submitCommandMock).toHaveBeenCalledTimes(1);
    expect(submitCommandMock).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "reservation.create",
        tenantId,
      }),
    );
  });

  it("proxies guest queries to the guests service", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/guests?tenant_id=11111111-1111-1111-1111-111111111111",
      headers: {
        authorization: "Bearer unit-test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(proxyRequestMock).toHaveBeenCalledTimes(1);
    expect(proxyRequestMock.mock.calls[0][2]).toBe(
      serviceTargets.guestsServiceUrl,
    );
    expect(response.json()).toEqual({
      proxied: true,
      targetUrl: serviceTargets.guestsServiceUrl,
    });
  });

  it("proxies guest grid queries to the guests service", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/guests/grid?tenant_id=11111111-1111-1111-1111-111111111111",
      headers: {
        authorization: "Bearer unit-test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(proxyRequestMock).toHaveBeenCalledTimes(1);
    expect(proxyRequestMock.mock.calls[0][2]).toBe(
      serviceTargets.guestsServiceUrl,
    );
    expect(response.json()).toEqual({
      proxied: true,
      targetUrl: serviceTargets.guestsServiceUrl,
    });
  });

  it("proxies reservation grid queries to the core service", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/reservations/grid?tenant_id=11111111-1111-1111-1111-111111111111",
      headers: {
        authorization: "Bearer unit-test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(proxyRequestMock).toHaveBeenCalledTimes(1);
    expect(proxyRequestMock.mock.calls[0][2]).toBe(
      serviceTargets.coreServiceUrl,
    );
    expect(response.json()).toEqual({
      proxied: true,
      targetUrl: serviceTargets.coreServiceUrl,
    });
  });

  it("returns command definitions directly (system-admin scope required)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/commands/definitions",
      headers: {
        authorization: "Bearer unit-test-token",
      },
    });

    // Route is a direct implementation, not a proxy — SYSTEM_ADMIN scope required.
    expect(response.statusCode).toBe(200);
    expect(proxyRequestMock).not.toHaveBeenCalled();
    expect(Array.isArray(response.json())).toBe(true);
  });

  it("proxies settings catalog queries to the core service (settings absorbed in Phase 5)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/settings/catalog",
      headers: {
        authorization: "Bearer unit-test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(proxyRequestMock).toHaveBeenCalledTimes(1);
    // Settings routes were absorbed into core-service in Phase 5; settingsServiceUrl removed.
    expect(proxyRequestMock.mock.calls[0][2]).toBe(
      serviceTargets.coreServiceUrl,
    );
    expect(response.json()).toEqual({
      proxied: true,
      targetUrl: serviceTargets.coreServiceUrl,
    });
  });
});
