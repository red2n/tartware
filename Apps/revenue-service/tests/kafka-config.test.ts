import { vi } from "vitest";

import { applyEnvOverrides, createKafkaConfigTests, resetEnv } from "@tartware/config/test-helpers";

createKafkaConfigTests("revenue-service", async (overrides) => {
vi.resetModules();
resetEnv();
applyEnvOverrides(overrides);
const { config } = await import("../src/config.js");
return config.kafka;
});
