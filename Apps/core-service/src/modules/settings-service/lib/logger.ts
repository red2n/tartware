import type { PinoLogger } from "@tartware/telemetry";
import { createServiceLogger } from "@tartware/telemetry";

import { config } from "../config.js";

export const appLogger: PinoLogger = createServiceLogger({
  serviceName: config.service.name,
  levelEnv: "SETTINGS_SERVICE_LOG_LEVEL",
  prettyEnv: "SETTINGS_SERVICE_LOG_PRETTY",
  environment: process.env.NODE_ENV,
  base: {
    serviceVersion: config.service.version,
  },
});
