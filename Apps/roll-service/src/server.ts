import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import { withRequestLogging } from "@tartware/telemetry";
import fastify from "fastify";

import { config } from "./config.js";
import { query, withTransaction } from "./lib/db.js";
import {
  batchDurationHistogram,
  metricsRegistry,
  processingLagGauge,
  replayDeltaCounter,
} from "./lib/metrics.js";
import backfillJobPlugin from "./plugins/backfill-job.js";
import lifecycleConsumerPlugin from "./plugins/lifecycle-consumer.js";

export const buildServer = () => {
  const app = fastify({
    logger: {
      level: config.log.level ?? "info",
    },
  });

  if (config.log.requestLogging) {
    withRequestLogging(app, {
      includeBody: false,
      includeRequestHeaders: false,
      includeResponseHeaders: false,
    });
  }

  void app.register(fastifyHelmet, { global: true });
  void app.register(fastifySensible);
  void app.register(lifecycleConsumerPlugin);
  void app.register(backfillJobPlugin);

  app.after(() => {
    replayDeltaCounter.inc(0);
    processingLagGauge.set(0);
    batchDurationHistogram.observe(0.01);
    void withTransaction(async (client) => {
      await client.query("SELECT 1");
    }).catch((error) => app.log.warn(error, "Shadow readiness warmup failed"));

    app.get(
      "/health",
      {
        schema: buildRouteSchema({
          tag: "Health",
          summary: "Health probe",
          response: { 200: jsonObjectSchema },
        }),
      },
      () => ({ status: "ok", service: config.service.name }),
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
          await query("SELECT 1");
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
          response: { 200: { type: "string" } },
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
