import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import {
  buildRouteSchema,
  jsonObjectSchema,
  schemaFromZod,
} from "@tartware/openapi";
import { ReservationCommandLifecycleSchema } from "@tartware/schemas";
import { withRequestLogging } from "@tartware/telemetry";
import fastify from "fastify";
import { z } from "zod";

import { serviceConfig } from "./config.js";
import { checkDatabaseHealth, checkKafkaHealth } from "./lib/health-checks.js";
import { metricsRegistry } from "./lib/metrics.js";
import swaggerPlugin from "./plugins/swagger.js";
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

export const buildServer = () => {
  const app = fastify({
    logger: true,
  });

  if (serviceConfig.requestLogging) {
    withRequestLogging(app, {
      includeBody: false,
      includeRequestHeaders: false,
      includeResponseHeaders: false,
    });
  }

  app.register(fastifyHelmet, { global: true });
  app.register(fastifySensible);
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
