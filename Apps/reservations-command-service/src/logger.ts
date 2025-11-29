import type { PinoLogger } from "@tartware/telemetry";
import { createServiceLogger } from "@tartware/telemetry";

import { serviceConfig } from "./config.js";

export const reservationsLogger: PinoLogger = createServiceLogger({
  serviceName: serviceConfig.serviceId,
  levelEnv: "RESERVATION_COMMAND_LOG_LEVEL",
  prettyEnv: "RESERVATION_COMMAND_LOG_PRETTY",
  environment: process.env.NODE_ENV,
});
