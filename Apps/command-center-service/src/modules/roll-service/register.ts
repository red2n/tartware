import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance } from "fastify";

import { config } from "./config.js";
import { query, withTransaction } from "./lib/db.js";
import {
  batchDurationHistogram,
  metricsRegistry,
  processingLagGauge,
  replayDeltaCounter,
} from "./lib/metrics.js";
import backfillJobPlugin from "./plugins/backfill-job.js";
import dateRollSchedulerPlugin from "./plugins/date-roll-scheduler.js";
import lifecycleConsumerPlugin from "./plugins/lifecycle-consumer.js";

const readinessCheck = async () => {
  await query("SELECT 1");
  return {
    status: "ready" as const,
    service: config.service.name,
    version: config.service.version,
    kafka: {
      activeCluster: config.kafka.activeCluster,
      brokers: config.kafka.brokers,
      primaryBrokers: config.kafka.primaryBrokers,
      failoverBrokers: config.kafka.failoverBrokers,
      topic: config.kafka.topic,
    },
  };
};

const readinessErrorResponse = () => ({
  status: "unavailable" as const,
  service: config.service.name,
  kafka: {
    activeCluster: config.kafka.activeCluster,
    brokers: config.kafka.brokers,
    primaryBrokers: config.kafka.primaryBrokers,
    failoverBrokers: config.kafka.failoverBrokers,
    topic: config.kafka.topic,
  },
});

export const registerRollModule = (app: FastifyInstance): void => {
  void app.register(lifecycleConsumerPlugin);
  void app.register(backfillJobPlugin);
  void app.register(dateRollSchedulerPlugin);

  app.after(() => {
    replayDeltaCounter.inc(0);
    processingLagGauge.set(0);
    batchDurationHistogram.observe(0.01);
    void withTransaction(async (client) => {
      await client.query("SELECT 1");
    }).catch((error) => app.log.warn(error, "Roll shadow readiness warmup failed"));

    void app.register(
      (rollApp, _options, done) => {
        rollApp.get(
          "/health",
          {
            schema: buildRouteSchema({
              tag: "Health",
              summary: "Roll module health probe",
              response: { 200: jsonObjectSchema },
            }),
          },
          () => ({ status: "ok", service: config.service.name, version: config.service.version }),
        );

        rollApp.get(
          "/health/readiness",
          {
            schema: buildRouteSchema({
              tag: "Health",
              summary: "Roll module readiness probe (deep)",
              response: {
                200: jsonObjectSchema,
                503: jsonObjectSchema,
              },
            }),
          },
          async (_request, reply) => {
            try {
              return await readinessCheck();
            } catch (error) {
              rollApp.log.error(error, "Roll readiness check failed");
              void reply.code(503);
              return readinessErrorResponse();
            }
          },
        );

        rollApp.get(
          "/ready",
          {
            schema: buildRouteSchema({
              tag: "Health",
              summary: "Roll module readiness probe",
              response: {
                200: jsonObjectSchema,
                503: jsonObjectSchema,
              },
            }),
          },
          async (_request, reply) => {
            try {
              return await readinessCheck();
            } catch (error) {
              rollApp.log.error(error, "Roll readiness check failed");
              void reply.code(503);
              return readinessErrorResponse();
            }
          },
        );

        rollApp.get(
          "/metrics",
          {
            schema: buildRouteSchema({
              tag: "Metrics",
              summary: "Roll module Prometheus metrics",
              response: { 200: { type: "string" } },
            }),
          },
          async (_request, reply) => {
            void reply.header("Content-Type", metricsRegistry.contentType);
            const metrics = await metricsRegistry.metrics();
            return metrics;
          },
        );

        done();
      },
      { prefix: "/internal/roll" },
    );

    app.get(
      "/v1/roll/scheduler-status",
      {
        schema: buildRouteSchema({
          tag: "Roll",
          summary: "Date roll scheduler status",
          response: { 200: jsonObjectSchema },
        }),
      },
      () => {
        if (!app.hasDecorator("dateRollScheduler")) {
          return { enabled: false, running: false };
        }

        return (
          app as unknown as { dateRollScheduler: { getStatus: () => unknown } }
        ).dateRollScheduler.getStatus();
      },
    );
  });
};
