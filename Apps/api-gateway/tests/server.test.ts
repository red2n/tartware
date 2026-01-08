import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildServer } from "../src/server.js";
import { kafkaConfig } from "../src/config.js";

const { submitCommandMock, proxyRequestMock } = vi.hoisted(() => {
  return {
    submitCommandMock: vi.fn(async ({ reply }) => {
      reply.status(202).send({
        status: "accepted",
        commandId: "cmd-1",
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

vi.mock("../src/services/membership-service.js", () => ({
  getUserMemberships: vi.fn(async () => [
    {
      tenantId: "tenant-123",
      tenantName: "Demo Hotel",
      role: "MANAGER",
      isActive: true,
      permissions: {},
      modules: ["core"],
    },
  ]),
}));

vi.mock("../src/lib/jwt.js", () => ({
  extractBearerToken: (header?: string) =>
    header?.split(" ")[1] ?? null,
  verifyAccessToken: vi.fn(() => ({ sub: "user-1" })),
}));

describe("API Gateway server", () => {
  let app: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
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
      kafka: {
        activeCluster: kafkaConfig.activeCluster,
        brokers: kafkaConfig.brokers,
        primaryBrokers: kafkaConfig.primaryBrokers,
        failoverBrokers: kafkaConfig.failoverBrokers,
        topic: kafkaConfig.commandTopic,
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
      url: "/v1/guests",
    });

    expect(response.statusCode).toBe(200);
    expect(proxyRequestMock).toHaveBeenCalledTimes(1);
    expect(proxyRequestMock.mock.calls[0][2]).toBe(
      "http://localhost:3300",
    );
    expect(response.json()).toEqual({
      proxied: true,
      targetUrl: "http://localhost:3300",
    });
  });
});
