import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const resetEnv = () => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, originalEnv);
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

  vi.doMock("@tartware/config", () => ({
    databaseSchema: {},
    loadServiceConfig: () => ({
      PORT: 3000,
      HOST: "0.0.0.0",
      SERVICE_NAME: "api-gateway",
      SERVICE_VERSION: "1.0.0",
      DB_HOST: "localhost",
      DB_PORT: 5432,
      DB_NAME: "tartware",
      DB_USER: "postgres",
      DB_PASSWORD: "password",
      DB_SSL: false,
      DB_POOL_MAX: 10,
      DB_POOL_IDLE_TIMEOUT_MS: 1000,
    }),
  }));

  const module = await import("../src/config.js");
  return module.kafkaConfig;
};

afterEach(() => {
  resetEnv();
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("@tartware/config");
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

  it("switches to failover brokers when enabled", async () => {
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

  it("honors explicit failover request even when primary exists", async () => {
    const kafkaConfig = await loadKafkaConfig({
      KAFKA_BROKERS: "broker-1:9092",
      KAFKA_FAILOVER_BROKERS: "failover-1:9092",
      KAFKA_ACTIVE_CLUSTER: "failover",
    });

    expect(kafkaConfig.activeCluster).toBe("failover");
    expect(kafkaConfig.brokers).toEqual(["failover-1:9092"]);
    expect(kafkaConfig.primaryBrokers).toEqual(["broker-1:9092"]);
  });

  it("falls back to failover brokers when primary is missing", async () => {
    const kafkaConfig = await loadKafkaConfig({
      KAFKA_BROKERS: "",
      KAFKA_FAILOVER_BROKERS: "failover-1:9092",
    });

    expect(kafkaConfig.activeCluster).toBe("failover");
    expect(kafkaConfig.brokers).toEqual(["failover-1:9092"]);
  });
});
