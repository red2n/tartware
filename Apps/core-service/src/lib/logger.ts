import type { PinoLogger } from "@tartware/telemetry";
import { createServiceLogger } from "@tartware/telemetry";

import { config } from "../config.js";

const CORE_REDACT_PATHS = [
  "req.body.password",
  "req.body.current_password",
  "req.body.new_password",
  "req.body.email",
  "req.body.emailAddress",
  "req.body.passport_number",
  "req.body.passportNumber",
  "req.body.card_number",
  "req.body.cardNumber",
  "req.body.payment.card_number",
  "req.body.payment.cardNumber",
  "req.body.payment.account_number",
  "req.body.payment.routing_number",
  "req.body.payment.cvv",
  "req.headers.authorization",
  "request.headers.authorization",
  "req.query.email",
  "req.query.passport_number",
  "req.query.card_number",
  "req.params.email",
  "request.params.email",
  "request.body.password",
  "request.body.email",
  "request.body.passport_number",
  "request.body.card_number",
  "request.body.payment.account_number",
  "request.body.payment.routing_number",
  "request.body.payment.cvv",
  "request.query.email",
  "request.query.passport_number",
  "request.query.card_number",
  "response.body.payment.card_number",
  "response.body.payment.cardNumber",
  "response.body.payment.cvv",
];

export const appLogger: PinoLogger = createServiceLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
  base: { version: config.service.version },
  useDefaultRedactions: true,
  redactPaths: CORE_REDACT_PATHS,
});
