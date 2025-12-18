import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";

import { config } from "./config.js";
import { ensureEncryptionRequirementsMet } from "./lib/compliance-policies.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import complianceMonitorPlugin from "./plugins/compliance-monitor.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import swaggerPlugin from "./plugins/swagger.js";
import systemAdminAuthPlugin from "./plugins/system-admin-auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerGuestRoutes } from "./routes/guests.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerHousekeepingRoutes } from "./routes/housekeeping.js";
import { registerModuleRoutes } from "./routes/modules.js";
import { registerPropertyRoutes } from "./routes/properties.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerReservationRoutes } from "./routes/reservations.js";
import { registerRoomRoutes } from "./routes/rooms.js";
import { registerSystemAuthRoutes } from "./routes/system-auth.js";
import { registerSystemImpersonationRoutes } from "./routes/system-impersonation.js";
import { registerSystemTenantRoutes } from "./routes/system-tenants.js";
import { registerSystemUserRoutes } from "./routes/system-users.js";
import { registerTenantRoutes } from "./routes/tenants.js";
import { registerUserTenantAssociationRoutes } from "./routes/user-tenant-associations.js";
import { registerUserRoutes } from "./routes/users.js";

const REDACTED_VALUE = "[REDACTED]" as const;
const SENSITIVE_LOG_KEYS = new Set(
  [
    "password",
    "current_password",
    "new_password",
    "passcode",
    "token",
    "email",
    "phone",
    "id_number",
    "passport_number",
    "ssn",
    "payment_reference",
    "card_number",
    "cvv",
    "authorization",
  ].map((key) => key.toLowerCase()),
);

const sanitizeLogValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }

  if (typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
    if (SENSITIVE_LOG_KEYS.has(key.toLowerCase())) {
      return [key, REDACTED_VALUE] as const;
    }
    return [key, sanitizeLogValue(nestedValue)] as const;
  });

  return Object.fromEntries(entries);
};

export const buildServer = (): FastifyInstance => {
  ensureEncryptionRequirementsMet();
  const app = Fastify({
    logger: appLogger as FastifyBaseLogger,
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
  app.register(swaggerPlugin);
  app.register(errorHandlerPlugin);
  app.register(authContextPlugin);
  app.register(systemAdminAuthPlugin);
  app.register(complianceMonitorPlugin);

  app.get("/metrics", async (request, reply) => {
    try {
      const body = await metricsRegistry.metrics();
      reply.header("Content-Type", metricsRegistry.contentType).send(body);
    } catch (error) {
      request.log.error(error, "failed to collect core-service metrics");
      reply.status(500).send("metrics_unavailable");
    }
  });

  if (config.log.requestLogging) {
    app.addHook("onRequest", async (request) => {
      request.log.info(
        {
          method: request.method,
          url: request.url,
          query: sanitizeLogValue(request.query),
          params: sanitizeLogValue(request.params),
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
    registerDashboardRoutes(app);
    registerReservationRoutes(app);
    registerRoomRoutes(app);
    registerHousekeepingRoutes(app);
    registerBillingRoutes(app);
    registerReportRoutes(app);
    registerModuleRoutes(app);
    registerSystemAuthRoutes(app);
    registerSystemTenantRoutes(app);
    registerSystemUserRoutes(app);
    registerSystemImpersonationRoutes(app);
  });

  app.addHook("onReady", async () => {
    const routeSummaries = Array.from(registeredRoutes.values()).map(
      ({ method, url }) => `(${method}) ${url}`,
    );
    app.log.info({ routes: routeSummaries }, "fastify routes registered");
  });

  return app;
};
