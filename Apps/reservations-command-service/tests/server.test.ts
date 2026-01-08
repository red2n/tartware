import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildServer } from "../src/server.js";
import { kafkaConfig } from "../src/config.js";
import {
  checkDatabaseHealth,
  checkKafkaHealth,
} from "../src/lib/health-checks.js";
import { getReliabilitySnapshot } from "../src/services/reliability-service.js";
import { listReservationLifecycle } from "../src/services/reservation-lifecycle-service.js";

vi.mock("../src/lib/health-checks.js", () => ({
  checkDatabaseHealth: vi.fn(),
  checkKafkaHealth: vi.fn(),
}));

vi.mock("../src/services/reliability-service.js", () => ({
  getReliabilitySnapshot: vi.fn(),
}));

vi.mock("../src/services/reservation-lifecycle-service.js", () => ({
  listReservationLifecycle: vi.fn(),
}));

const buildApp = async () => {
  const app = buildServer();
  await app.ready();
  return app;
};

describe("reservations-command-service HTTP routes", () => {
  beforeEach(() => {
    vi.mocked(checkDatabaseHealth).mockResolvedValue(undefined);
    vi.mocked(checkKafkaHealth).mockResolvedValue(undefined);
  });

  it("returns basic health status", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: expect.stringContaining("reservations-command-service"),
    });

    await app.close();
  });

  it("includes readiness probes that fail closed when dependencies are unavailable", async () => {
    const app = await buildApp();
    const error = new Error("database offline");
    vi.mocked(checkDatabaseHealth).mockRejectedValueOnce(error);

    const response = await app.inject({
      method: "GET",
      url: "/health/readiness",
    });

    expect(checkDatabaseHealth).toHaveBeenCalledTimes(1);
    expect(checkKafkaHealth).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "unavailable",
      service: process.env.RESERVATION_COMMAND_ID,
      error: error.message,
      kafka: {
        activeCluster: kafkaConfig.activeCluster,
        brokers: kafkaConfig.brokers,
        primaryBrokers: kafkaConfig.primaryBrokers,
        failoverBrokers: kafkaConfig.failoverBrokers,
        topic: kafkaConfig.topic,
      },
    });

    await app.close();
  });

  it("reports readiness when dependencies respond", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health/readiness",
    });

    expect(checkDatabaseHealth).toHaveBeenCalledTimes(1);
    expect(checkKafkaHealth).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ready",
      service: process.env.RESERVATION_COMMAND_ID,
      kafka: {
        activeCluster: kafkaConfig.activeCluster,
        brokers: kafkaConfig.brokers,
        primaryBrokers: kafkaConfig.primaryBrokers,
        failoverBrokers: kafkaConfig.failoverBrokers,
        topic: kafkaConfig.topic,
      },
    });

    await app.close();
  });

  it("exposes a reliability snapshot", async () => {
    const app = await buildApp();
    const snapshot = {
      status: "healthy",
      generatedAt: new Date().toISOString(),
      issues: [],
      outbox: { pending: 0, warnThreshold: 100, criticalThreshold: 500 },
      consumer: {
        partitions: 3,
        stalePartitions: 0,
        maxSecondsSinceCommit: 2,
        staleThresholdSeconds: 60,
      },
      lifecycle: {
        stalledCommands: 0,
        oldestStuckSeconds: null,
        dlqTotal: 0,
        stalledThresholdSeconds: 120,
      },
      dlq: {
        depth: 0,
        warnThreshold: 10,
        criticalThreshold: 50,
        topic: "reservations.events.dlq",
        error: null,
      },
    } as const;
    vi.mocked(getReliabilitySnapshot).mockResolvedValueOnce(snapshot);

    const response = await app.inject({
      method: "GET",
      url: "/health/reliability",
    });

    expect(getReliabilitySnapshot).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(snapshot);

    await app.close();
  });

  it("serves reservation lifecycle records", async () => {
    const app = await buildApp();
    const lifecycleEntries = [
      {
        event_id: "evt-1",
        tenant_id: "11111111-1111-1111-1111-111111111111",
        reservation_id: "22222222-2222-2222-2222-222222222222",
        command_name: "reservation.create",
        correlation_id: "corr-1",
        partition_key: "tenant",
        current_state: "APPLIED",
        state_transitions: [],
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];
    vi.mocked(listReservationLifecycle).mockResolvedValueOnce(lifecycleEntries);

    const tenantId = "11111111-1111-1111-1111-111111111111";
    const reservationId = "22222222-2222-2222-2222-222222222222";
    const response = await app.inject({
      method: "GET",
      url: `/v1/reservations/${reservationId}/lifecycle?tenant_id=${tenantId}`,
    });

    expect(listReservationLifecycle).toHaveBeenCalledWith(
      tenantId,
      reservationId,
    );
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      lifecycleEntries.map((entry) => ({
        ...entry,
        created_at: entry.created_at.toISOString(),
        updated_at: entry.updated_at.toISOString(),
      })),
    );

    await app.close();
  });

  it("exports Prometheus metrics", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/metrics",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.body.length).toBeGreaterThan(0);

    await app.close();
  });
});
