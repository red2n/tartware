import { afterEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";

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

describe("roll-service kafka failover selection", () => {
  it("prefers primary brokers by default", async () => {
    const kafka = await loadKafka({
      KAFKA_BROKERS: "p1:9092,p2:9092",
      KAFKA_FAILOVER_BROKERS: "f1:9092",
    });

    expect(kafka.primaryBrokers).toEqual(["p1:9092", "p2:9092"]);
    expect(kafka.failoverBrokers).toEqual(["f1:9092"]);
    expect(kafka.activeCluster).toBe("primary");
    expect(kafka.brokers).toEqual(["p1:9092", "p2:9092"]);
  });

  it("switches to failover when enabled", async () => {
    const kafka = await loadKafka({
      KAFKA_BROKERS: "p1:9092",
      KAFKA_FAILOVER_BROKERS: "f1:9092,f2:9092",
      KAFKA_FAILOVER_ENABLED: "true",
    });

    expect(kafka.activeCluster).toBe("failover");
    expect(kafka.brokers).toEqual(["f1:9092", "f2:9092"]);
  });

  it("honors explicit failover selection", async () => {
    const kafka = await loadKafka({
      KAFKA_BROKERS: "p1:9092",
      KAFKA_FAILOVER_BROKERS: "f1:9092",
      KAFKA_ACTIVE_CLUSTER: "failover",
    });

    expect(kafka.activeCluster).toBe("failover");
    expect(kafka.brokers).toEqual(["f1:9092"]);
  });

  it("falls back to failover when primary list is empty", async () => {
    const kafka = await loadKafka({
      KAFKA_BROKERS: "",
      KAFKA_FAILOVER_BROKERS: "f1:9092",
    });

    expect(kafka.activeCluster).toBe("failover");
    expect(kafka.brokers).toEqual(["f1:9092"]);
  });
});
