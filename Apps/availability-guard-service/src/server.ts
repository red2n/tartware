import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import { buildFastifyServer } from "@tartware/fastify-server";

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
  const app = buildFastifyServer({
    logger: appLogger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: true,
    metricsRegistry,
    serverOptions: {
      // Disable plugin timeout during dev to allow Kafka/GRPC startup without failing fast
      pluginTimeout: 0,
    },
  });

  const SHUTDOWN_STEP_TIMEOUT_MS = 5_000;

  const shutdownStep = async (label: string, fn: () => Promise<void>) => {
    app.log.info({ step: label }, "shutdown step starting");
    const timer = setTimeout(() => {
      app.log.error(
        { step: label, timeoutMs: SHUTDOWN_STEP_TIMEOUT_MS },
        "shutdown step timed out",
      );
    }, SHUTDOWN_STEP_TIMEOUT_MS);
    timer.unref();

    try {
      await fn();
    } catch (error) {
      app.log.error({ err: error, step: label }, "shutdown step failed");
    } finally {
      clearTimeout(timer);
      app.log.info({ step: label }, "shutdown step finished");
    }
  };

  void app.register(swaggerPlugin);
  if (process.env.SKIP_GRPC !== "true") {
    void app.register(grpcServerPlugin);
  } else {
    app.log.warn("Skipping gRPC server startup (SKIP_GRPC=true)");
  }
  void app.register(locksRoutes);
  app.addHook("onReady", () => {
    app.log.info("starting manual release notification consumer");
    void startManualReleaseNotificationConsumer(app.log).catch((err: unknown) =>
      app.log.error(
        { err },
        "failed to start manual release notification consumer",
      ),
    );
    app.log.info("starting availability guard command consumer");
    void startAvailabilityGuardCommandCenterConsumer(app.log).catch(
      (err: unknown) =>
        app.log.error(
          { err },
          "failed to start availability guard command consumer",
        ),
    );
  });
  app.addHook("onClose", async () => {
    // Shutdown in proper order: stop consumers first, then notification dispatcher
    await shutdownStep("command-consumer", () =>
      shutdownAvailabilityGuardCommandCenterConsumer(app.log),
    );
    await shutdownStep("manual-release-consumer", () =>
      shutdownManualReleaseNotificationConsumer(app.log),
    );
    await shutdownStep("notification-dispatcher", () =>
      shutdownNotificationDispatcher(),
    );
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
