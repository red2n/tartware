import { buildRouteSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply } from "fastify";

import { gatewayConfig, kafkaConfig, serviceTargets } from "../config.js";

import { HEALTH_TAG, healthResponseSchema, readinessResponseSchema } from "./schemas.js";

/** Timeout (ms) for individual health checks when aggregating. */
const HEALTH_CHECK_TIMEOUT_MS = 3000;

interface ServiceHealthResult {
  service: string;
  status: "ok" | "error";
  latencyMs: number;
  error?: string;
}

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

export const registerHealthRoutes = (app: FastifyInstance): void => {
  const kafkaSummary = {
    activeCluster: kafkaConfig.activeCluster,
    brokers: kafkaConfig.brokers,
    primaryBrokers: kafkaConfig.primaryBrokers,
    failoverBrokers: kafkaConfig.failoverBrokers,
    topic: kafkaConfig.commandTopic,
  } as const;

  const allowCorsHeaders = (reply: FastifyReply): FastifyReply =>
    reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
      .header(
        "Access-Control-Allow-Headers",
        "Accept, Authorization, Content-Type, X-Requested-With, DNT, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform",
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
        summary: "API gateway readiness status.",
        response: {
          200: readinessResponseSchema,
        },
      }),
    },
    async (_request, reply) => {
      allowCorsHeaders(reply);
      return reply.send({
        status: "ok",
        service: gatewayConfig.serviceId,
        kafka: kafkaSummary,
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
