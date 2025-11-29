import type { PinoLogger } from "@tartware/telemetry";
import { createLogger } from "@tartware/telemetry";

import { config } from "../config.js";

export const appLogger: PinoLogger = createLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
  base: { version: config.service.version },
});
