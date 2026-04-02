import type { RateLimitPluginOptions } from "@fastify/rate-limit";
import rateLimit from "@fastify/rate-limit";
import { buildFastifyServer, resolveServiceRegistryConfig } from "@tartware/fastify-server";
import { buildRouteSchema, jsonObjectSchema, schemaFromZod } from "@tartware/openapi";
import { ReservationCommandLifecycleSchema, SERVICE_REGISTRY_CATALOG } from "@tartware/schemas";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { checkGuardHealth } from "./clients/availability-guard-client.js";
import { kafkaConfig, reliabilityConfig, serviceConfig } from "./config.js";
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
const RELIABILITY_SNAPSHOT_REFRESH_MS = 30_000;

const createUnavailableReliabilitySnapshot = (issue: string): ReliabilitySnapshot => ({
  status: "degraded",
  generatedAt: new Date().toISOString(),
  issues: [issue],
  outbox: {
    pending: 0,
    warnThreshold: reliabilityConfig.outboxWarnThreshold,
    criticalThreshold: reliabilityConfig.outboxCriticalThreshold,
  },
  consumer: {
    partitions: 0,
    stalePartitions: 0,
    maxSecondsSinceCommit: null,
    staleThresholdSeconds: reliabilityConfig.consumerStaleSeconds,
  },
  lifecycle: {
    stalledCommands: 0,
    oldestStuckSeconds: null,
    dlqTotal: 0,
    stalledThresholdSeconds: reliabilityConfig.stalledThresholdSeconds,
  },
  dlq: {
    depth: null,
    warnThreshold: reliabilityConfig.dlqWarnThreshold,
    criticalThreshold: reliabilityConfig.dlqCriticalThreshold,
    topic: kafkaConfig.dlqTopic,
    error: issue,
  },
});

export const buildServer = (): FastifyInstance => {
  const registryMetadata = SERVICE_REGISTRY_CATALOG["reservations-command-service"];
  let reliabilitySnapshot = createUnavailableReliabilitySnapshot("snapshot_pending");
  let reliabilitySnapshotRefreshTimer: ReturnType<typeof setInterval> | null = null;
  const app = buildFastifyServer({
    logger: reservationsLogger,
    enableRequestLogging: serviceConfig.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: false, // Custom metrics endpoint below
    serviceRegistry: resolveServiceRegistryConfig({
      ...registryMetadata,
      serviceVersion: serviceConfig.version,
      host: serviceConfig.host,
      port: serviceConfig.port,
    }),
  });

  app.register(
    rateLimit as unknown as FastifyPluginAsync,
    {
      max: serviceConfig.rateLimit.max,
      timeWindow: serviceConfig.rateLimit.timeWindow,
    } as RateLimitPluginOptions,
  );

  app.register(swaggerPlugin);

  const refreshReliabilitySnapshot = async () => {
    try {
      reliabilitySnapshot = await getReliabilitySnapshot();
    } catch (error) {
      app.log.error(error, "Failed to refresh reliability snapshot");
      reliabilitySnapshot = createUnavailableReliabilitySnapshot(
        error instanceof Error ? error.message : "snapshot_refresh_failed",
      );
    }
  };

  const refreshReliabilitySnapshotInBackground = () => {
    void refreshReliabilitySnapshot();
  };

  app.addHook("onReady", () => {
    setImmediate(refreshReliabilitySnapshotInBackground);
    reliabilitySnapshotRefreshTimer = setInterval(() => {
      refreshReliabilitySnapshotInBackground();
    }, RELIABILITY_SNAPSHOT_REFRESH_MS);
    reliabilitySnapshotRefreshTimer.unref();
  });

  app.addHook("onClose", async () => {
    if (reliabilitySnapshotRefreshTimer) {
      clearInterval(reliabilitySnapshotRefreshTimer);
      reliabilitySnapshotRefreshTimer = null;
    }
  });

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

    const kafkaSummary = {
      activeCluster: kafkaConfig.activeCluster,
      brokers: kafkaConfig.brokers,
      primaryBrokers: kafkaConfig.primaryBrokers,
      failoverBrokers: kafkaConfig.failoverBrokers,
      topic: kafkaConfig.topic,
    } as const;

    app.get(
      "/health/readiness",
      {
        preHandler: app.rateLimit({
          max: serviceConfig.rateLimit.readMax,
          timeWindow: serviceConfig.rateLimit.readTimeWindow,
        }),
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
          const [, , guardHealthy] = await Promise.all([
            checkDatabaseHealth(),
            checkKafkaHealth(),
            checkGuardHealth().catch(() => false),
          ]);
          return {
            status: "ready",
            service: serviceConfig.serviceId,
            kafka: kafkaSummary,
            availabilityGuard: guardHealthy ? "serving" : "unavailable",
          };
        } catch (error) {
          app.log.error(error, "Readiness check failed");
          void reply.code(503);
          return {
            status: "unavailable",
            service: serviceConfig.serviceId,
            kafka: kafkaSummary,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    );

    app.get(
      "/health/reliability",
      {
        preHandler: app.rateLimit({
          max: serviceConfig.rateLimit.readMax,
          timeWindow: serviceConfig.rateLimit.readTimeWindow,
        }),
        schema: buildRouteSchema({
          tag: "Health",
          summary: "Command pipeline reliability snapshot",
          response: {
            200: ReliabilitySnapshotJsonSchema,
          },
        }),
      },
      async () => reliabilitySnapshot,
    );

    app.get(
      "/metrics",
      {
        preHandler: app.rateLimit({
          max: serviceConfig.rateLimit.metricsMax,
          timeWindow: serviceConfig.rateLimit.metricsTimeWindow,
        }),
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
        preHandler: app.rateLimit({
          max: serviceConfig.rateLimit.readMax,
          timeWindow: serviceConfig.rateLimit.readTimeWindow,
        }),
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
        const entries = await listReservationLifecycle(query.tenant_id, params.reservationId);
        return entries;
      },
    );
  });

  return app;
};
