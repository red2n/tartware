import process from "node:process";

import { ensureDependencies, parseHostPort, resolveOtelDependency } from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";

import { config } from "./config.js";
import { buildServer } from "./server.js";

const telemetry = await initTelemetry({
  serviceName: config.service.name,
  serviceVersion: config.service.version,
  environment: process.env.NODE_ENV ?? "development",
  instrumentationOptions: {
    "@opentelemetry/instrumentation-fastify": { enabled: true },
    "@opentelemetry/instrumentation-http": { enabled: true },
    "@opentelemetry/instrumentation-pg": { enabled: true },
  },
});

const app = buildServer();

const start = async () => {
  try {
    const telemetryDependency = resolveOtelDependency(true);
    const dependenciesOk = await ensureDependencies(
      [
        { name: "PostgreSQL", host: config.db.host, port: config.db.port },
        ...(config.kafka.brokers[0]
          ? [
              {
                name: "Kafka broker",
                ...parseHostPort(config.kafka.brokers[0], 9092),
              },
            ]
          : []),
        ...(telemetryDependency ? [telemetryDependency] : []),
      ],
      { logger: app.log },
    );
    if (!dependenciesOk) {
      app.log.warn("Dependencies missing; exiting");
      await telemetry
        ?.shutdown()
        .catch((error) => app.log.error(error, "Failed to shutdown telemetry"));
      process.exit(0);
    }

    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      {
        port: config.port,
        host: config.host,
        shadowMode: config.shadowMode,
      },
      "Roll service started",
    );
  } catch (error) {
    app.log.error(error, "Failed to start roll service");
    await telemetry
      ?.shutdown()
      .catch((shutdownError) => app.log.error(shutdownError, "Failed to shutdown telemetry"));
    process.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutdown signal received");
  try {
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((error) => app.log.error(error, "Failed to shutdown telemetry"));
    process.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await start();
