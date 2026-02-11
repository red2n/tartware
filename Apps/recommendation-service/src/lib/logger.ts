import { createServiceLogger, type PinoLogger } from "@tartware/telemetry";

import { config } from "../config.js";

export const appLogger: PinoLogger = createServiceLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: config.nodeEnv,
});
