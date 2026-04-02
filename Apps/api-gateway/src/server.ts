import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import rateLimit from "@fastify/rate-limit";
import { buildFastifyServer, resolveServiceRegistryConfig } from "@tartware/fastify-server";
import { SERVICE_REGISTRY_CATALOG } from "@tartware/schemas";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { Redis } from "ioredis";

import { devToolsConfig, gatewayConfig } from "./config.js";
import { registerDuploDashboard } from "./devtools/duplo-dashboard.js";
import { metricsRegistry } from "./lib/metrics.js";
import { gatewayLogger } from "./logger.js";
import authContextPlugin from "./plugins/auth-context.js";
import sseTokenPlugin from "./plugins/sse-token.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerBillingRoutes } from "./routes/billing-routes.js";
import { registerBookingConfigRoutes } from "./routes/booking-config-routes.js";
import { registerCalculationRoutes } from "./routes/calculation-routes.js";
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
  const registryMetadata = SERVICE_REGISTRY_CATALOG["api-gateway"];
  const app = buildFastifyServer({
    logger: gatewayLogger,
    enableRequestLogging: gatewayConfig.logRequests,
    corsOrigin: false,
    enableMetricsEndpoint: true,
    metricsRegistry,
    serviceRegistry: resolveServiceRegistryConfig({
      ...registryMetadata,
      serviceVersion: gatewayConfig.version,
      host: gatewayConfig.host,
      port: gatewayConfig.port,
    }),
  });

  app.register(swaggerPlugin);
  app.register(sseTokenPlugin);

  const rateLimitOptions: RateLimitPluginOptions = {
    max: gatewayConfig.rateLimit.max,
    timeWindow: gatewayConfig.rateLimit.timeWindow,
    keyGenerator: (request: FastifyRequest) =>
      (request.headers["x-api-key"] as string | undefined) ?? request.ip ?? "anonymous",
    ban: 0,
  };

  if (gatewayConfig.redis.enabled) {
    const redisClient = new Redis({
      host: gatewayConfig.redis.host,
      port: gatewayConfig.redis.port,
      password: gatewayConfig.redis.password,
      db: gatewayConfig.redis.db,
      keyPrefix: gatewayConfig.redis.keyPrefix,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on("error", (err: Error) => {
      gatewayLogger.warn({ err }, "Redis rate-limit client error");
    });

    void redisClient
      .connect()
      .then(() => {
        gatewayLogger.info("Redis rate-limit client connected; using distributed store");
        (rateLimitOptions as RateLimitPluginOptions & { redis: unknown }).redis = redisClient;
      })
      .catch(() => {
        gatewayLogger.warn("Redis rate-limit client failed to connect; using in-memory store");
      });

    // Gracefully close the Redis client on shutdown
    app.addHook("onClose", async () => {
      await redisClient.quit().catch(() => {});
    });

    // skipOnError: true → if Redis is transiently unavailable the rate limiter
    // allows the request through instead of throwing a 500.
    (rateLimitOptions as RateLimitPluginOptions & { skipOnError: boolean }).skipOnError = true;
  }

  app.register(
    rateLimit as unknown as FastifyPluginAsync,
    rateLimitOptions as unknown as RateLimitPluginOptions,
  );
  app.register(authContextPlugin);

  app.after(() => {
    if (devToolsConfig.duploDashboard.enabled) {
      registerDuploDashboard(app, {
        sharedSecret: devToolsConfig.duploDashboard.sharedSecret,
      });
    } else {
      app.log.debug("Duplo dashboard disabled for this environment");
    }

    const allowCorsHeaders = (reply: FastifyReply): FastifyReply =>
      reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
        .header(
          "Access-Control-Allow-Headers",
          "Accept, Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Requested-With, DNT, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform",
        )
        .header("Access-Control-Max-Age", "600");

    app.addHook("onRequest", async (request, reply) => {
      allowCorsHeaders(reply);
      if (request.method.toUpperCase() === "OPTIONS") {
        return reply.status(204).send();
      }
    });

    // Register all route groups
    // GET routes proxy to backend services; POST/PUT/PATCH/DELETE routes
    // dispatch Kafka commands via command-helpers (CQRS write path).
    registerHealthRoutes(app);
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
