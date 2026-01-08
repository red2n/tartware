import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => {
  return {
    query: vi.fn(async () => {}),
    withTransaction: vi.fn(async (fn: (client: { query: () => Promise<void> }) => Promise<void>) => {
      await fn({ query: async () => {} });
    }),
  };
});

vi.mock("../src/plugins/lifecycle-consumer.js", () => ({
  default: async (_app: unknown) => {},
}));

vi.mock("../src/plugins/backfill-job.js", () => ({
  default: async (_app: unknown) => {},
}));

import { buildServer } from "../src/server.js";
import { config } from "../src/config.js";

describe("roll-service readiness", () => {
  let app: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns kafka summary in readiness", async () => {
    const response = await app.inject({ method: "GET", url: "/health/readiness" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ready",
      service: config.service.name,
      kafka: {
        activeCluster: config.kafka.activeCluster,
        brokers: config.kafka.brokers,
        primaryBrokers: config.kafka.primaryBrokers,
        failoverBrokers: config.kafka.failoverBrokers,
        topic: config.kafka.topic,
      },
    });
  });
});
