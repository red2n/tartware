import process from "node:process";

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

const start = async () => {
  try {
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
    process.exit(1);
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
    process.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await start();
