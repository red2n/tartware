import { afterEach, describe, expect, it, vi } from "vitest";

const initialEnv = { ...process.env };

const resetEnv = () => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in initialEnv)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, initialEnv);
};

const loadKafkaConfig = async (
  overrides: Record<string, string | undefined>,
) => {
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
  return module.kafkaConfig;
};

afterEach(() => {
  resetEnv();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("kafkaConfig failover selection", () => {
  it("uses primary brokers by default", async () => {
    const kafkaConfig = await loadKafkaConfig({
      KAFKA_BROKERS: "broker-1:9092,broker-2:9092",
      KAFKA_FAILOVER_BROKERS: "failover-1:9092",
    });

    expect(kafkaConfig.primaryBrokers).toEqual([
      "broker-1:9092",
      "broker-2:9092",
    ]);
    expect(kafkaConfig.failoverBrokers).toEqual(["failover-1:9092"]);
    expect(kafkaConfig.activeCluster).toBe("primary");
    expect(kafkaConfig.brokers).toEqual([
      "broker-1:9092",
      "broker-2:9092",
    ]);
  });

  it("switches to failover when enabled", async () => {
    const kafkaConfig = await loadKafkaConfig({
      KAFKA_BROKERS: "broker-1:9092",
      KAFKA_FAILOVER_BROKERS: "failover-1:9092,failover-2:9092",
      KAFKA_FAILOVER_ENABLED: "true",
    });

    expect(kafkaConfig.activeCluster).toBe("failover");
    expect(kafkaConfig.brokers).toEqual([
      "failover-1:9092",
      "failover-2:9092",
    ]);
  });

  it("honors explicit failover request", async () => {
    const kafkaConfig = await loadKafkaConfig({
      KAFKA_BROKERS: "broker-1:9092",
      KAFKA_FAILOVER_BROKERS: "failover-1:9092",
      KAFKA_ACTIVE_CLUSTER: "failover",
    });

    expect(kafkaConfig.activeCluster).toBe("failover");
    expect(kafkaConfig.brokers).toEqual(["failover-1:9092"]);
    expect(kafkaConfig.primaryBrokers).toEqual(["broker-1:9092"]);
  });

  it("falls back to failover when primary list is empty", async () => {
    const kafkaConfig = await loadKafkaConfig({
      KAFKA_BROKERS: "",
      KAFKA_FAILOVER_BROKERS: "failover-1:9092",
    });

    expect(kafkaConfig.activeCluster).toBe("failover");
    expect(kafkaConfig.brokers).toEqual(["failover-1:9092"]);
  });
});
