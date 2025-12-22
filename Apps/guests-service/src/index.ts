import process from "node:process";

import { ensureDependencies, parseHostPort, resolveOtelDependency } from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";

import {
  shutdownGuestsCommandCenterConsumer,
  startGuestsCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
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
const kafkaEnabled = process.env.DISABLE_KAFKA !== "true";

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
          app.log.error(shutdownError, "failed to shutdown telemetry"),
        );
      process.exit(0);
      return;
    }

    if (kafkaEnabled) {
      await startGuestsCommandCenterConsumer();
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
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError: unknown) =>
        app.log.error(shutdownError, "failed to shutdown telemetry"),
      );
    process.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutdown signal received");
  try {
    if (kafkaEnabled) {
      await shutdownGuestsCommandCenterConsumer();
    }
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError: unknown) =>
        app.log.error(shutdownError, "failed to shutdown telemetry"),
      );
    process.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await start();
