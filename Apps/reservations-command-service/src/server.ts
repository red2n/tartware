import { buildFastifyServer } from "@tartware/fastify-server";
import {
  buildRouteSchema,
  jsonObjectSchema,
  schemaFromZod,
} from "@tartware/openapi";
import { ReservationCommandLifecycleSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { serviceConfig } from "./config.js";
import { checkDatabaseHealth, checkKafkaHealth } from "./lib/health-checks.js";
import { metricsRegistry } from "./lib/metrics.js";
import { reservationsLogger } from "./logger.js";
import swaggerPlugin from "./plugins/swagger.js";
import type { ReliabilitySnapshot } from "./services/reliability-service.js";
import { getReliabilitySnapshot } from "./services/reliability-service.js";
import { listReservationLifecycle } from "./services/reservation-lifecycle-service.js";

const ReservationLifecycleParamsSchema = z.object({
  reservationId: z.string().uuid(),
});
const ReservationLifecycleQuerySchema = z.object({
  tenant_id: z.string().uuid(),
});

const ReservationLifecycleParamsJsonSchema = schemaFromZod(
  ReservationLifecycleParamsSchema,
  "ReservationLifecycleParams",
);
const ReservationLifecycleQueryJsonSchema = schemaFromZod(
  ReservationLifecycleQuerySchema,
  "ReservationLifecycleQuery",
);
const ReservationLifecycleResponseJsonSchema = schemaFromZod(
  z.array(ReservationCommandLifecycleSchema),
  "ReservationLifecycleResponse",
);
const ReliabilitySnapshotSchema = z.object({
  status: z.enum(["healthy", "degraded", "critical"]),
  generatedAt: z.string(),
  issues: z.array(z.string()),
  outbox: z.object({
    pending: z.number(),
    warnThreshold: z.number(),
    criticalThreshold: z.number(),
  }),
  consumer: z.object({
    partitions: z.number(),
    stalePartitions: z.number(),
    maxSecondsSinceCommit: z.number().nullable(),
    staleThresholdSeconds: z.number(),
  }),
  lifecycle: z.object({
    stalledCommands: z.number(),
    oldestStuckSeconds: z.number().nullable(),
    dlqTotal: z.number(),
    stalledThresholdSeconds: z.number(),
  }),
  dlq: z.object({
    depth: z.number().nullable(),
    warnThreshold: z.number(),
    criticalThreshold: z.number(),
    topic: z.string(),
    error: z.string().nullable(),
  }),
});
const ReliabilitySnapshotJsonSchema = schemaFromZod(
  ReliabilitySnapshotSchema,
  "ReliabilitySnapshot",
);

export const buildServer = (): FastifyInstance => {
  const app = buildFastifyServer({
    logger: reservationsLogger,
    enableRequestLogging: serviceConfig.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: false, // Custom metrics endpoint below
  });

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

    app.get("/ready", async () => ({
      status: "ready",
      service: serviceConfig.serviceId,
    }));

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
      "/health/reliability",
      {
        schema: buildRouteSchema({
          tag: "Health",
          summary: "Command pipeline reliability snapshot",
          response: {
            200: ReliabilitySnapshotJsonSchema,
          },
        }),
      },
      async () => {
        const snapshot: ReliabilitySnapshot = await getReliabilitySnapshot();
        return snapshot;
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

    app.get(
      "/v1/reservations/:reservationId/lifecycle",
      {
        schema: buildRouteSchema({
          tag: "Reservation Lifecycle",
          summary: "Inspect lifecycle states for a reservation",
          params: ReservationLifecycleParamsJsonSchema,
          querystring: ReservationLifecycleQueryJsonSchema,
          response: {
            200: ReservationLifecycleResponseJsonSchema,
          },
        }),
      },
      async (request) => {
        const params = ReservationLifecycleParamsSchema.parse(request.params);
        const query = ReservationLifecycleQuerySchema.parse(request.query);
        const entries = await listReservationLifecycle(
          query.tenant_id,
          params.reservationId,
        );
        return entries;
      },
    );
  });

  return app;
};
