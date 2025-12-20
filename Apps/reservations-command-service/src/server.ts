import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import { withRequestLogging } from "@tartware/telemetry";
import fastify, { type FastifyBaseLogger } from "fastify";

import { serviceConfig } from "./config.js";
import { checkDatabaseHealth, checkKafkaHealth } from "./lib/health-checks.js";
import { metricsRegistry } from "./lib/metrics.js";
import { reservationsLogger } from "./logger.js";
import swaggerPlugin from "./plugins/swagger.js";

export const buildServer = () => {
  const app = fastify({
    logger: reservationsLogger as FastifyBaseLogger,
  });

  if (serviceConfig.requestLogging) {
    withRequestLogging(app, {
      includeBody: false,
      includeRequestHeaders: false,
      includeResponseHeaders: false,
    });
  }

  app.register(fastifyHelmet, { global: true });
  app.register(fastifySensible);
  app.register(swaggerPlugin);

  app.after(() => {
    app.get(
      "/health",
      {
        schema: buildRouteSchema({
          tag: "Health",
          summary: "Reservation command health check",
          response: {
            200: jsonObjectSchema,
          },
        }),
      },
      async () => ({
        status: "ok",
        service: serviceConfig.serviceId,
      }),
    );

    app.get(
      "/health/liveness",
      {
        schema: buildRouteSchema({
          tag: "Health",
          summary: "Liveness probe endpoint",
          response: {
            200: jsonObjectSchema,
          },
        }),
      },
      async () => ({
        status: "alive",
        service: serviceConfig.serviceId,
      }),
    );

    app.get(
      "/health/readiness",
      {
        schema: buildRouteSchema({
          tag: "Health",
          summary: "Readiness probe (DB + Kafka)",
          response: {
            200: jsonObjectSchema,
            503: jsonObjectSchema,
          },
        }),
      },
      async (_request, reply) => {
        try {
          await Promise.all([checkDatabaseHealth(), checkKafkaHealth()]);
          return {
            status: "ready",
            service: serviceConfig.serviceId,
          };
        } catch (error) {
          app.log.error(error, "Readiness check failed");
          void reply.code(503);
          return {
            status: "unavailable",
            service: serviceConfig.serviceId,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    );

    app.get(
      "/metrics",
      {
        schema: buildRouteSchema({
          tag: "Metrics",
          summary: "Prometheus metrics endpoint",
          response: {
            200: {
              type: "string",
              description: "Prometheus text exposition format",
            },
          },
        }),
      },
      async (_request, reply) => {
        void reply.header("Content-Type", metricsRegistry.contentType);
        return metricsRegistry.metrics();
      },
    );
  });

  return app;
};
