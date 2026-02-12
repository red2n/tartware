import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import rateLimit from "@fastify/rate-limit";
import { buildFastifyServer } from "@tartware/fastify-server";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { devToolsConfig, gatewayConfig } from "./config.js";
import { registerDuploDashboard } from "./devtools/duplo-dashboard.js";
import { gatewayLogger } from "./logger.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerBillingRoutes } from "./routes/billing-routes.js";
import { registerBookingConfigRoutes } from "./routes/booking-config-routes.js";
import { registerCoreProxyRoutes } from "./routes/core-proxy-routes.js";
import { registerGuestRoutes } from "./routes/guest-routes.js";
import { registerHealthRoutes } from "./routes/health-routes.js";
import { registerHousekeepingRoutes } from "./routes/housekeeping-routes.js";
import { registerMiscRoutes } from "./routes/misc-routes.js";
import { registerOperationsRoutes } from "./routes/operations-routes.js";
import { registerReservationRoutes } from "./routes/reservation-routes.js";
import { registerRevenueRoutes } from "./routes/revenue-routes.js";
import { registerRoomRoutes } from "./routes/room-routes.js";
import { registerSelfServiceRoutes } from "./routes/self-service-routes.js";

export const buildServer = () => {
  const app = buildFastifyServer({
    logger: gatewayLogger,
    enableRequestLogging: gatewayConfig.logRequests,
    corsOrigin: false,
    enableMetricsEndpoint: false,
  });

  app.register(swaggerPlugin);
  app.register(authContextPlugin);

  app.register(
    rateLimit as unknown as FastifyPluginAsync,
    {
      max: gatewayConfig.rateLimit.max,
      timeWindow: gatewayConfig.rateLimit.timeWindow,
      keyGenerator: (request: FastifyRequest) =>
        (request.headers["x-api-key"] as string | undefined) ?? request.ip ?? "anonymous",
      ban: 0,
    } as unknown as RateLimitPluginOptions,
  );

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
          "Accept, Authorization, Content-Type, X-Requested-With, DNT, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform",
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
    registerRevenueRoutes(app);
    registerSelfServiceRoutes(app);
    registerMiscRoutes(app);
  });

  return app;
};
