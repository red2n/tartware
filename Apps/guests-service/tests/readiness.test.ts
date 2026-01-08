import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";
import { config } from "../src/config.js";

describe("guests-service readiness", () => {
  let app: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns kafka summary in readiness", async () => {
    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ready",
      service: config.service.name,
      version: config.service.version,
      kafka: {
        activeCluster: config.kafka.activeCluster,
        brokers: config.kafka.brokers,
        primaryBrokers: config.kafka.primaryBrokers,
        failoverBrokers: config.kafka.failoverBrokers,
        topic: config.commandCenter.topic,
      },
    });
  });
});
