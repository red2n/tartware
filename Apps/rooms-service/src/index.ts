import process from "node:process";

import { ensureDependencies, parseHostPort, resolveOtelDependency } from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";

import {
  shutdownRoomsCommandCenterConsumer,
  startRoomsCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import { shutdownProducer } from "./kafka/producer.js";
import { closePool as closeRecommendationPool } from "./modules/recommendation-service/lib/db.js";
import { initializePipeline } from "./modules/recommendation-service/services/index.js";
import { buildServer } from "./server.js";

const telemetry = await initTelemetry({
  serviceName: config.service.name,
  serviceVersion: config.service.version,
  environment: process.env.NODE_ENV ?? "development",
  instrumentationOptions: {
    "@opentelemetry/instrumentation-fastify": {
      enabled: true,
    },
    "@opentelemetry/instrumentation-http": {
      enabled: true,
    },
    "@opentelemetry/instrumentation-pg": {
      enabled: true,
    },
  },
});

const app = buildServer();
const proc = process;
const kafkaEnabled = process.env.DISABLE_KAFKA !== "true";
let isShuttingDown = false;
let recommendationPoolClosed = false;

const isPoolAlreadyClosedError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("Called end on pool more than once");

const closeRecommendationPoolSafely = async () => {
  if (recommendationPoolClosed) {
    return;
  }
  try {
    await closeRecommendationPool();
    recommendationPoolClosed = true;
  } catch (error) {
    if (isPoolAlreadyClosedError(error)) {
      recommendationPoolClosed = true;
      app.log.warn("Recommendation pool was already closed");
      return;
    }
    throw error;
  }
};

const start = async () => {
  try {
    const kafkaBroker = config.kafka.brokers[0];
    const telemetryDependency = resolveOtelDependency(true);
    const dependenciesOk = await ensureDependencies(
      [
        { name: "PostgreSQL", host: config.db.host, port: config.db.port },
        ...(kafkaEnabled && kafkaBroker
          ? [{ name: "Kafka broker", ...parseHostPort(kafkaBroker, 9092) }]
          : []),
        ...(telemetryDependency ? [telemetryDependency] : []),
      ],
      { logger: app.log },
    );
    if (!dependenciesOk) {
      app.log.warn("Dependencies missing; exiting without starting service");
      await telemetry
        ?.shutdown()
        .catch((shutdownError: unknown) =>
          app.log.error(shutdownError, "Failed to shutdown telemetry"),
        );
      if (proc) {
        proc.exit(0);
      } else {
        return;
      }
    }

    initializePipeline();

    if (kafkaEnabled) {
      await startRoomsCommandCenterConsumer();
    } else {
      app.log.warn("Kafka disabled via DISABLE_KAFKA; skipping consumer start");
    }
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      {
        port: config.port,
        host: config.host,
        environment: process.env.NODE_ENV ?? "development",
      },
      `${config.service.name} started`,
    );
  } catch (error) {
    app.log.error(error, `Failed to start ${config.service.name}`);
    await closeRecommendationPoolSafely();
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError) => app.log.error(shutdownError, "failed to shutdown telemetry"));
    proc?.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  if (isShuttingDown) {
    app.log.info({ signal }, "shutdown already in progress");
    return;
  }
  isShuttingDown = true;

  app.log.info({ signal }, "shutdown signal received");
  try {
    if (kafkaEnabled) {
      await shutdownRoomsCommandCenterConsumer();
      await shutdownProducer();
    }
    await closeRecommendationPoolSafely();
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError) => app.log.error(shutdownError, "failed to shutdown telemetry"));
    proc?.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    proc?.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await start();
