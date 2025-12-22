import process from "node:process";

import {
  ensureDependencies,
  parseHostPort,
  resolveOtelDependency,
} from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";

import { config } from "./config.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";
import {
  shutdownCommandRegistry,
  startCommandRegistry,
} from "./services/command-registry-service.js";
import {
  shutdownCommandOutboxDispatcher,
  startCommandOutboxDispatcher,
} from "./services/outbox-dispatcher.js";

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

const start = async () => {
  try {
    const kafkaBroker = config.kafka.brokers[0];
    const telemetryDependency = resolveOtelDependency(true);
    const dependenciesOk = await ensureDependencies(
      [
        { name: "PostgreSQL", host: config.db.host, port: config.db.port },
        ...(kafkaBroker
          ? [
              {
                name: "Kafka broker",
                ...parseHostPort(kafkaBroker, 9092),
              },
            ]
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

    await startCommandRegistry();
    startCommandOutboxDispatcher();
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
    await app.close();
    await shutdownCommandRegistry().catch((registryError) =>
      app.log.error(registryError, "failed to shutdown command registry"),
    );
    await shutdownCommandOutboxDispatcher().catch((dispatcherError) =>
      app.log.error(dispatcherError, "failed to stop outbox dispatcher"),
    );
    await shutdownProducer().catch((producerError) =>
      app.log.error(producerError, "failed to shutdown Kafka producer"),
    );
    await telemetry
      ?.shutdown()
      .catch((shutdownError) =>
        app.log.error(shutdownError, "failed to shutdown telemetry"),
      );
    proc?.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutdown signal received");
  try {
    await shutdownCommandRegistry().catch((error) =>
      app.log.error(error, "failed to shutdown command registry"),
    );
    await shutdownCommandOutboxDispatcher().catch((error) =>
      app.log.error(error, "failed to stop outbox dispatcher"),
    );
    await shutdownProducer().catch((error) =>
      app.log.error(error, "failed to shutdown Kafka producer"),
    );
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError) =>
        app.log.error(shutdownError, "failed to shutdown telemetry"),
      );
    proc?.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    proc?.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await start();
