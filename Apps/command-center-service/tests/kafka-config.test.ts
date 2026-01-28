import { afterEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.AUTH_DEFAULT_PASSWORD =
  process.env.AUTH_DEFAULT_PASSWORD ?? "ChangeMe123!";
if (!process.env.AUTH_JWT_SECRET || process.env.AUTH_JWT_SECRET.length < 32) {
  process.env.AUTH_JWT_SECRET = "test-secret-change-me-32-characters-minimum";
}

const baseEnv = { ...process.env };

const resetEnv = () => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in baseEnv)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, baseEnv);
};

const loadKafka = async (overrides: Record<string, string | undefined>) => {
  vi.resetModules();
  resetEnv();

  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
      return;
    }
    process.env[key] = value;
  });

  const module = await import("../src/config.js");
  return module.config.kafka;
};

afterEach(() => {
  resetEnv();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("command-center kafka failover selection", () => {
  it("prefers primary brokers by default", async () => {
    const kafka = await loadKafka({
      COMMAND_CENTER_KAFKA_BROKERS: "p1:9092,p2:9092",
      COMMAND_CENTER_KAFKA_FAILOVER_BROKERS: "f1:9092",
    });

    expect(kafka.primaryBrokers).toEqual(["p1:9092", "p2:9092"]);
    expect(kafka.failoverBrokers).toEqual(["f1:9092"]);
    expect(kafka.activeCluster).toBe("primary");
    expect(kafka.brokers).toEqual(["p1:9092", "p2:9092"]);
  });

  it("switches to failover when enabled", async () => {
    const kafka = await loadKafka({
      COMMAND_CENTER_KAFKA_BROKERS: "p1:9092",
      COMMAND_CENTER_KAFKA_FAILOVER_BROKERS: "f1:9092,f2:9092",
      COMMAND_CENTER_KAFKA_FAILOVER_ENABLED: "true",
    });

    expect(kafka.activeCluster).toBe("failover");
    expect(kafka.brokers).toEqual(["f1:9092", "f2:9092"]);
  });

  it("honors explicit failover selection", async () => {
    const kafka = await loadKafka({
      COMMAND_CENTER_KAFKA_BROKERS: "p1:9092",
      COMMAND_CENTER_KAFKA_FAILOVER_BROKERS: "f1:9092",
      COMMAND_CENTER_KAFKA_ACTIVE_CLUSTER: "failover",
    });

    expect(kafka.activeCluster).toBe("failover");
    expect(kafka.brokers).toEqual(["f1:9092"]);
  });

  it("falls back to failover when primary list is empty", async () => {
    const kafka = await loadKafka({
      COMMAND_CENTER_KAFKA_BROKERS: "",
      COMMAND_CENTER_KAFKA_FAILOVER_BROKERS: "f1:9092",
    });

    expect(kafka.activeCluster).toBe("failover");
    expect(kafka.brokers).toEqual(["f1:9092"]);
  });
});
