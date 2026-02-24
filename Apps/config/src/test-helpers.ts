import { afterEach, describe, expect, it, vi } from "vitest";

type KafkaConfig = {
  primaryBrokers: string[];
  failoverBrokers: string[];
  activeCluster: string;
  brokers: string[];
};

const baseEnv = { ...process.env };

/** Reset `process.env` to the snapshot taken at module load time. */
export const resetEnv = (): void => {
  for (const key of Object.keys(process.env)) {
    if (!(key in baseEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, baseEnv);
};

/** Apply environment variable overrides (set or delete). */
export const applyEnvOverrides = (overrides: Record<string, string | undefined>): void => {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

type KafkaConfigLoader = (overrides: Record<string, string | undefined>) => Promise<KafkaConfig>;

/**
 * Create a standardized kafka failover test suite for a service.
 *
 * The caller provides a `loadKafka` callback that resets modules, applies env
 * overrides, and dynamically imports the service's config.
 *
 * @example
 * ```ts
 * import { createKafkaConfigTests, resetEnv, applyEnvOverrides } from "@tartware/config/test-helpers";
 * import { vi } from "vitest";
 *
 * createKafkaConfigTests("billing-service", async (overrides) => {
 *   vi.resetModules();
 *   resetEnv();
 *   applyEnvOverrides(overrides);
 *   const { config } = await import("../src/config.js");
 *   return config.kafka;
 * });
 * ```
 */
export const createKafkaConfigTests = (serviceName: string, loadKafka: KafkaConfigLoader): void => {
  afterEach(() => {
    resetEnv();
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe(`${serviceName} kafka failover selection`, () => {
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
};
