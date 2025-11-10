import pino, { type LoggerOptions } from "pino";

import { config } from "../config.js";

const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
const isProduction = nodeEnv === "production";
const enablePretty = config.log.pretty && !isProduction && Boolean(process.stdout?.isTTY);
const transportOptions = enablePretty
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        singleLine: true,
      },
    }
  : undefined;

const sharedLoggerOptions: LoggerOptions = {
  level: config.log.level,
  base: { service: "@tartware/core-service" },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: transportOptions,
};

export const logger = pino(sharedLoggerOptions);
export const fastifyLoggerOptions: LoggerOptions = {
  ...sharedLoggerOptions,
  transport: transportOptions,
};
