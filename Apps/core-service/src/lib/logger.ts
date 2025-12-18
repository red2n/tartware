import type { PinoLogger } from "@tartware/telemetry";
import { createLogger } from "@tartware/telemetry";

import { config } from "../config.js";

const LOG_REDACT_PATHS: string[] = [
  "req.headers",
  "res.headers",
  "request.headers",
  "response.headers",
  "*.password",
  "*.current_password",
  "*.new_password",
  "*.passcode",
  "*.token",
  "*.email",
  "*.phone",
  "*.id_number",
  "*.passport_number",
  "*.ssn",
  "*.payment_reference",
  "*.card_number",
  "*.cvv",
  "*.authorization",
];

const LOG_REDACT_CONFIG = {
  paths: LOG_REDACT_PATHS,
  censor: "[REDACTED]",
};

export const appLogger: PinoLogger = createLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
  base: { version: config.service.version },
  redact: LOG_REDACT_CONFIG,
});
