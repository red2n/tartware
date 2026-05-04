import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import rateLimit from "@fastify/rate-limit";
import { buildFastifyServer, sseTokenPromotePlugin } from "@tartware/fastify-server";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

import { devToolsConfig, gatewayConfig } from "./config.js";
import { registerDuploDashboard } from "./devtools/duplo-dashboard.js";
import { metricsRegistry } from "./lib/metrics.js";
import { initRedisClient, shutdownRedisClient } from "./lib/redis.js";
import { gatewayLogger } from "./logger.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerBillingRoutes } from "./routes/billing-routes.js";
import { registerBookingConfigRoutes } from "./routes/booking-config-routes.js";
import { registerCalculationRoutes } from "./routes/calculation-routes.js";
import { registerCommandCenterRoutes } from "./routes/command-center-routes.js";
import { registerCoreProxyRoutes } from "./routes/core-proxy-routes.js";
import { registerGuestRoutes } from "./routes/guest-routes.js";
import { registerHealthRoutes } from "./routes/health-routes.js";
import { registerHousekeepingRoutes } from "./routes/housekeeping-routes.js";
import { registerMiscRoutes } from "./routes/misc-routes.js";
import { registerOperationsRoutes } from "./routes/operations-routes.js";
import { registerRegistryProxyRoutes } from "./routes/registry-proxy-routes.js";
import { registerReportingRoutes } from "./routes/reporting-routes.js";
import { registerReservationRoutes } from "./routes/reservation-routes.js";
import { registerRevenueRoutes } from "./routes/revenue-routes.js";
import { registerRoomRoutes } from "./routes/room-routes.js";
import { registerSelfServiceRoutes } from "./routes/self-service-routes.js";
import { registerWebhookRoutes } from "./routes/webhook-routes.js";

export const buildServer = () => {
  const app = buildFastifyServer({
    logger: gatewayLogger,
    enableRequestLogging: gatewayConfig.logRequests,
    corsOrigin: gatewayConfig.corsOrigin,
    corsCredentials: true,
    corsAllowedHeaders: [
      "Accept",
      "Idempotency-Key",
      "X-Idempotency-Key",
      "X-Correlation-Id",
      "X-Requested-With",
      "DNT",
      "sec-ch-ua",
      "sec-ch-ua-mobile",
      "sec-ch-ua-platform",
    ],
    enableMetricsEndpoint: true,
    metricsRegistry,
  });

  app.register(swaggerPlugin);
  app.register(sseTokenPromotePlugin);
  app.register(authContextPlugin);

  const rateLimitOptions: RateLimitPluginOptions = {
    max: gatewayConfig.rateLimit.max,
    timeWindow: gatewayConfig.rateLimit.timeWindow,
    keyGenerator: (request: FastifyRequest) =>
      (request.headers["x-api-key"] as string | undefined) ?? request.ip ?? "anonymous",
    ban: 0,
  };

  if (gatewayConfig.redis.enabled) {
    // Initialise the shared Redis client (used by rate limiter + circuit breaker).
    // initRedisClient is idempotent; connection is attempted eagerly at startup.
    void initRedisClient().then((client) => {
      if (client) {
        gatewayLogger.info(
          "Redis connected; using distributed rate-limit and circuit-breaker stores",
        );
        (rateLimitOptions as RateLimitPluginOptions & { redis: unknown }).redis = client;
      } else {
        gatewayLogger.warn(
          "Redis unavailable; rate-limit and circuit-breaker fall back to in-memory",
        );
      }
    });

    // Gracefully close the Redis client on shutdown
    app.addHook("onClose", async () => {
      await shutdownRedisClient();
    });

    // skipOnError: true → if Redis is transiently unavailable the rate limiter
    // allows the request through instead of throwing a 500.
    (rateLimitOptions as RateLimitPluginOptions & { skipOnError: boolean }).skipOnError = true;
  }

  app.register(
    rateLimit as unknown as FastifyPluginAsync,
    rateLimitOptions as unknown as RateLimitPluginOptions,
  );

  app.after(() => {
    if (devToolsConfig.duploDashboard.enabled) {
      registerDuploDashboard(app, {
        sharedSecret: devToolsConfig.duploDashboard.sharedSecret,
      });
    } else {
      app.log.debug("Duplo dashboard disabled for this environment");
    }

    // Register all route groups
    // GET routes proxy to backend services; POST/PUT/PATCH/DELETE routes
    // dispatch Kafka commands via command-helpers (CQRS write path).
    registerHealthRoutes(app);
    registerCommandCenterRoutes(app);
    registerCoreProxyRoutes(app);
    registerReservationRoutes(app);
    registerGuestRoutes(app);
    registerRoomRoutes(app);
    registerBookingConfigRoutes(app);
    registerOperationsRoutes(app);
    registerHousekeepingRoutes(app);
    registerBillingRoutes(app);
    registerCalculationRoutes(app);
    registerRevenueRoutes(app);
    registerReportingRoutes(app);
    registerWebhookRoutes(app);
    registerSelfServiceRoutes(app);
    registerRegistryProxyRoutes(app);
    registerMiscRoutes(app);
  });

  return app;
};
