import type { Writable } from "node:stream";

import { createPinoOptions } from "@tartware/telemetry";
import type { FastifyBaseLogger } from "fastify";
import pino from "pino";

import { config } from "../config.js";

export const fastifyLoggerOptions = createPinoOptions({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
});

export const appLogger = pino({
  ...fastifyLoggerOptions,
  name: config.service.name,
});

export const attachLoggerTransportFallback = (logger: FastifyBaseLogger): void => {
  const streamSym = pino.symbols.streamSym as symbol;
  const loggerSymbols = logger as unknown as Record<symbol, unknown>;
  const transportStream = loggerSymbols[streamSym] as
    | (Writable & { on?: Writable["on"] })
    | undefined;

  let transportFailed = false;

  if (transportStream?.on) {
    transportStream.on("error", (error: unknown) => {
      if (!transportFailed) {
        transportFailed = true;
        console.error("[logger] OTLP transport failed – falling back to stdout:", error);
      }
      try {
        if (typeof transportStream.end === "function") {
          transportStream.end();
        }
      } catch {
        // ignore shutdown errors – we're switching transports anyway
      }
      const fallback = pino.destination({ sync: false });
      loggerSymbols[streamSym] = fallback;
    });
  }
};
