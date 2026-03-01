/**
 * Gateway health, readiness, and aggregated service-health routes.
 *
 * - `/health` — Lightweight liveness probe (always returns 200 when the
 *   process is running).
 * - `/ready` — Dependency-aware readiness probe that checks the database,
 *   Kafka broker list, and core-service connectivity. Returns 503 when any
 *   dependency is degraded.
 * - `/health/all` — Fan-out health check against every registered upstream
 *   service; used by monitoring dashboards.
 *
 * @module health-routes
 */
import { buildRouteSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply } from "fastify";

import { gatewayConfig, kafkaConfig, serviceTargets } from "../config.js";
import { query } from "../lib/db.js";

import { HEALTH_TAG, healthResponseSchema } from "./schemas.js";

/** Timeout (ms) for individual health checks when aggregating. */
const HEALTH_CHECK_TIMEOUT_MS = 3000;

interface ServiceHealthResult {
  service: string;
  status: "ok" | "error";
  latencyMs: number;
  error?: string;
}

/**
 * Probe a single upstream service’s `/health` endpoint.
 *
 * @param name - Human-readable service identifier for reporting.
 * @param baseUrl - Base URL of the upstream service (e.g. `http://localhost:3000`).
 * @returns Health check result with status and latency.
 */
async function checkServiceHealth(name: string, baseUrl: string): Promise<ServiceHealthResult> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return {
      service: name,
      status: response.ok ? "ok" : "error",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      service: name,
      status: "error",
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/** Register health, readiness, and aggregated health routes on the gateway. */
export const registerHealthRoutes = (app: FastifyInstance): void => {
  const allowCorsHeaders = (reply: FastifyReply): FastifyReply =>
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
      .header(
        "Access-Control-Allow-Headers",
        "Accept, Authorization, Content-Type, Idempotency-Key, X-Correlation-Id, X-Requested-With, DNT, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform",
      )
      .header("Access-Control-Max-Age", "600");

  app.options(
    "/health",
    {
      schema: {
        tags: [HEALTH_TAG],
        summary: "Pre-flight health request (CORS).",
        hide: true,
        response: {
          204: {
            type: "null",
            description: "CORS pre-flight acknowledgement.",
          },
        },
      },
    },
    async (_request, reply) => {
      allowCorsHeaders(reply);
      return reply.status(204).send();
    },
  );

  app.get(
    "/health",
    {
      schema: buildRouteSchema({
        tag: HEALTH_TAG,
        summary: "API gateway health status.",
        response: {
          200: healthResponseSchema,
        },
      }),
    },
    async (_request, reply) => {
      allowCorsHeaders(reply);
      return reply.send({
        status: "ok",
        service: gatewayConfig.serviceId,
      });
    },
  );

  app.get(
    "/ready",
    {
      schema: buildRouteSchema({
        tag: HEALTH_TAG,
        summary: "Dependency-aware readiness probe (DB, Kafka, core service).",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              service: { type: "string" },
              checks: {
                type: "object",
                properties: {
                  database: {
                    type: "object",
                    properties: { status: { type: "string" }, latencyMs: { type: "number" } },
                    required: ["status"],
                  },
                  kafka: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                      activeCluster: { type: "string" },
                      brokers: { type: "array", items: { type: "string" } },
                    },
                    required: ["status"],
                  },
                  coreService: {
                    type: "object",
                    properties: { status: { type: "string" }, latencyMs: { type: "number" } },
                    required: ["status"],
                  },
                },
                required: ["database", "kafka", "coreService"],
              },
            },
            required: ["status", "service", "checks"],
          } as const,
          503: {
            type: "object",
            properties: {
              status: { type: "string" },
              service: { type: "string" },
              checks: { type: "object", additionalProperties: true },
            },
            required: ["status", "service", "checks"],
          } as const,
        },
      }),
    },
    async (_request, reply) => {
      allowCorsHeaders(reply);

      const dbCheck = await (async () => {
        const start = performance.now();
        try {
          await query("SELECT 1");
          return { status: "ok" as const, latencyMs: Math.round(performance.now() - start) };
        } catch {
          return { status: "error" as const, latencyMs: Math.round(performance.now() - start) };
        }
      })();

      const coreCheck = await checkServiceHealth("core-service", serviceTargets.coreServiceUrl);

      const kafkaCheck = {
        status: kafkaConfig.brokers.length > 0 ? ("ok" as const) : ("error" as const),
        activeCluster: kafkaConfig.activeCluster,
        brokers: kafkaConfig.brokers,
      };

      const allOk =
        dbCheck.status === "ok" && coreCheck.status === "ok" && kafkaCheck.status === "ok";

      return reply.status(allOk ? 200 : 503).send({
        status: allOk ? "ok" : "degraded",
        service: gatewayConfig.serviceId,
        checks: {
          database: dbCheck,
          kafka: kafkaCheck,
          coreService: { status: coreCheck.status, latencyMs: coreCheck.latencyMs },
        },
      });
    },
  );

  app.get(
    "/health/all",
    {
      schema: buildRouteSchema({
        tag: HEALTH_TAG,
        summary: "Aggregated health status of all backend services.",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              services: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    service: { type: "string" },
                    status: { type: "string" },
                    latencyMs: { type: "number" },
                    error: { type: "string" },
                  },
                  required: ["service", "status", "latencyMs"],
                },
              },
            },
            required: ["status", "services"],
          } as const,
        },
      }),
    },
    async (_request, reply) => {
      const checks = [
        { name: "core-service", url: serviceTargets.coreServiceUrl },
        { name: "settings-service", url: serviceTargets.settingsServiceUrl },
        { name: "guests-service", url: serviceTargets.guestsServiceUrl },
        { name: "rooms-service", url: serviceTargets.roomsServiceUrl },
        { name: "reservations-command-service", url: serviceTargets.reservationCommandServiceUrl },
        { name: "billing-service", url: serviceTargets.billingServiceUrl },
        { name: "housekeeping-service", url: serviceTargets.housekeepingServiceUrl },
        { name: "command-center-service", url: serviceTargets.commandCenterServiceUrl },
        { name: "recommendation-service", url: serviceTargets.recommendationServiceUrl },
        { name: "notification-service", url: serviceTargets.notificationServiceUrl },
      ];

      const results = await Promise.all(
        checks.map(({ name, url }) => checkServiceHealth(name, url)),
      );

      const allHealthy = results.every((r) => r.status === "ok");
      allowCorsHeaders(reply);
      return reply.status(allHealthy ? 200 : 503).send({
        status: allHealthy ? "ok" : "degraded",
        services: results,
      });
    },
  );
};
