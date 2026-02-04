import pino from "pino";

import { config } from "../config.js";

export const appLogger = pino({
  name: config.service.name,
  level: config.log.level,
  transport: config.log.pretty
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
        },
      }
    : undefined,
});
