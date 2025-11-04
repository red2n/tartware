import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { config } from "./config.js";
import { fastifyLoggerOptions } from "./lib/logger.js";
import authContextPlugin from "./plugins/auth-context.js";
import { registerGuestRoutes } from "./routes/guests.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerPropertyRoutes } from "./routes/properties.js";
import { registerTenantRoutes } from "./routes/tenants.js";
import { registerUserTenantAssociationRoutes } from "./routes/user-tenant-associations.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerAuthRoutes } from "./routes/auth.js";

export const buildServer = (): FastifyInstance => {
  const app = Fastify({
    logger: fastifyLoggerOptions,
    disableRequestLogging: !config.log.requestLogging,
  });

  const registeredRoutes = new Map<string, { method: string; url: string }>();

  app.addHook("onRoute", (routeOptions) => {
    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method ?? "GET"];

    for (const method of methods) {
      if (typeof method !== "string") {
        continue;
      }

      const normalizedMethod = method.toUpperCase();
      if (normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
        continue;
      }

      const routeKey = `${normalizedMethod} ${routeOptions.url}`;
      registeredRoutes.set(routeKey, {
        method: normalizedMethod,
        url: routeOptions.url,
      });
    }
  });

  app.register(fastifySensible);
  app.register(fastifyHelmet, { global: true });
  app.register(fastifyCors, { origin: true });
  app.register(authContextPlugin);

  if (config.log.requestLogging) {
    app.addHook("onRequest", async (request) => {
      request.log.info(
        {
          method: request.method,
          url: request.url,
          query: request.query,
          params: request.params,
        },
        "request received",
      );
    });

    app.addHook("onResponse", async (request, reply) => {
      const durationMs = reply.elapsedTime ?? reply.getResponseTime();
      request.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          durationMs,
        },
        "request completed",
      );
    });
  }

  app.after(() => {
    registerHealthRoutes(app);
    registerAuthRoutes(app);
    registerTenantRoutes(app);
    registerPropertyRoutes(app);
    registerUserRoutes(app);
    registerGuestRoutes(app);
    registerUserTenantAssociationRoutes(app);
  });

  app.addHook("onReady", async () => {
    const routeSummaries = Array.from(registeredRoutes.values()).map(
      ({ method, url }) => `(${method}) ${url}`,
    );
    app.log.info({ routes: routeSummaries }, "fastify routes registered");
  });

  return app;
};
