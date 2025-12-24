import { createServiceLogger } from "@tartware/telemetry";

import { config } from "../config.js";

export const rollLogger = createServiceLogger({
  serviceName: config.service.name,
  levelEnv: "ROLL_SERVICE_LOG_LEVEL",
  prettyEnv: "ROLL_SERVICE_LOG_PRETTY",
  base: {
    serviceVersion: config.service.version,
  },
});
