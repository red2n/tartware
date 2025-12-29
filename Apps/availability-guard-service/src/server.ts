import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import {
  buildSecureRequestLoggingOptions,
  withRequestLogging,
} from "@tartware/telemetry";
import fastify, { type FastifyBaseLogger } from "fastify";

import { config } from "./config.js";
import { checkDatabaseHealth } from "./lib/health-checks.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import { shutdownNotificationDispatcher } from "./lib/notification-dispatcher.js";
import grpcServerPlugin from "./plugins/grpc-server.js";
import swaggerPlugin from "./plugins/swagger.js";
import { locksRoutes } from "./routes/locks.js";
import {
  shutdownAvailabilityGuardCommandCenterConsumer,
  startAvailabilityGuardCommandCenterConsumer,
} from "./workers/command-center-consumer.js";
import {
  shutdownManualReleaseNotificationConsumer,
  startManualReleaseNotificationConsumer,
} from "./workers/manual-release-notification-consumer.js";

export const buildServer = () => {
  const app = fastify({
    logger: appLogger as FastifyBaseLogger,
    disableRequestLogging: !config.log.requestLogging,
  });

  if (config.log.requestLogging) {
    withRequestLogging(app, buildSecureRequestLoggingOptions());
  }

  void app.register(fastifyHelmet, { global: true });
  void app.register(fastifySensible);
  void app.register(swaggerPlugin);
  void app.register(grpcServerPlugin);
  void app.register(locksRoutes);
  app.addHook("onReady", async () => {
    await startManualReleaseNotificationConsumer(app.log);
    await startAvailabilityGuardCommandCenterConsumer(app.log);
  });
  app.addHook("onClose", async () => {
    // Shutdown in proper order: stop consumers first, then notification dispatcher
    await shutdownAvailabilityGuardCommandCenterConsumer(app.log);
    await shutdownManualReleaseNotificationConsumer(app.log);
    await shutdownNotificationDispatcher();
  });

  app.after(() => {
    app.get(
      "/health",
      {
        schema: buildRouteSchema({
          tag: "Health",
          summary: "Basic health probe",
          response: { 200: jsonObjectSchema },
        }),
      },
      () => ({ status: "ok", service: config.service.name }),
    );

    app.get("/ready", () => ({
      status: "ready",
      service: config.service.name,
    }));

    app.get(
      "/health/liveness",
      {
        schema: buildRouteSchema({
          tag: "Health",
          summary: "Liveness probe",
          response: { 200: jsonObjectSchema },
        }),
      },
      () => ({ status: "alive", service: config.service.name }),
    );

    app.get(
      "/health/readiness",
      {
        schema: buildRouteSchema({
          tag: "Health",
          summary: "Readiness probe",
          response: {
            200: jsonObjectSchema,
            503: jsonObjectSchema,
          },
        }),
      },
      async (_request, reply) => {
        try {
          await checkDatabaseHealth();
          return { status: "ready", service: config.service.name };
        } catch (error) {
          app.log.error(error, "Readiness check failed");
          void reply.code(503);
          return { status: "unavailable", service: config.service.name };
        }
      },
    );

    app.get(
      "/metrics",
      {
        schema: buildRouteSchema({
          tag: "Metrics",
          summary: "Prometheus metrics",
          response: {
            200: { type: "string" },
          },
        }),
      },
      async (_request, reply) => {
        void reply.header("Content-Type", metricsRegistry.contentType);
        const metrics = await metricsRegistry.metrics();
        return metrics;
      },
    );
  });

  return app;
};
