import { createPinoOptions } from "@tartware/telemetry";
import type { LoggerOptions } from "pino";

import { config } from "../config.js";

export const fastifyLoggerOptions: LoggerOptions = {
  ...createPinoOptions({
    serviceName: config.service.name,
    level: config.log.level,
    pretty: config.log.pretty,
    environment: process.env.NODE_ENV,
  }),
};
