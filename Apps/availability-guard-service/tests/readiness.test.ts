import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/workers/command-center-consumer.js", () => ({
  startAvailabilityGuardCommandCenterConsumer: vi.fn(async () => {}),
  shutdownAvailabilityGuardCommandCenterConsumer: vi.fn(async () => {}),
}));

vi.mock("../src/workers/manual-release-notification-consumer.js", () => ({
  startManualReleaseNotificationConsumer: vi.fn(async () => {}),
  shutdownManualReleaseNotificationConsumer: vi.fn(async () => {}),
}));

vi.mock("../src/plugins/grpc-server.js", () => ({
  default: async (_app: unknown) => {},
}));

vi.mock("../src/lib/health-checks.js", () => ({
  checkDatabaseHealth: vi.fn(async () => {}),
}));

import { buildServer } from "../src/server.js";
import { config } from "../src/config.js";

describe("availability-guard readiness", () => {
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
        topics: [
          config.kafka.reservationEventsTopic,
          config.kafka.inventoryEventsTopic,
        ],
      },
    });
  });
});
