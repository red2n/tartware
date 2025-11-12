import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import type { PinoLogger } from "@tartware/telemetry";
import Fastify from "fastify";

import { config } from "./config.js";
import { authPlugin } from "./plugins/auth.js";

type BuildServerOptions = {
  logger: PinoLogger;
};

export const buildServer = ({ logger }: BuildServerOptions) => {
  const app = Fastify({
    logger,
  });

  void app.register(helmet, { global: true });
  void app.register(cors, { origin: false });
  void app.register(sensible);
  void app.register(authPlugin);

  if (config.log.requestLogging) {
    app.addHook("onResponse", (request, reply, done) => {
      request.log.info({
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.getResponseTime(),
      });
      done();
    });
  }

  app.get("/health", async () => ({
    status: "ok",
    service: config.service.name,
    version: config.service.version,
    uptime: process.uptime(),
  }));

  app.register(async (secureRoutes) => {
    secureRoutes.addHook("onRequest", secureRoutes.authenticate);

    secureRoutes.get("/v1/settings/ping", async () => ({
      status: "ok",
      scope: "protected",
    }));
  });

  return app;
};
