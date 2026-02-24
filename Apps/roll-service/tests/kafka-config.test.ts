import { vi } from "vitest";

import { applyEnvOverrides, createKafkaConfigTests, resetEnv } from "@tartware/config/test-helpers";

process.env.NODE_ENV = "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";

createKafkaConfigTests("roll-service", async (overrides) => {
  vi.resetModules();
  resetEnv();
  applyEnvOverrides(overrides);
  const { config } = await import("../src/config.js");
  return config.kafka;
});
