import process from "node:process";

import { ensureDependencies, resolveOtelDependency } from "@tartware/config";
import { createServiceLogger, initTelemetry } from "@tartware/telemetry";

import { buildServer } from "./app.js";
import { config } from "./config.js";

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

const logger = createServiceLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
});

const server = buildServer({ logger });

try {
  const telemetryDependency = resolveOtelDependency(true);
  const dependenciesOk = await ensureDependencies(
    [
      { name: "PostgreSQL", host: config.db.host, port: config.db.port },
      ...(telemetryDependency ? [telemetryDependency] : []),
    ],
    { logger },
  );
  if (!dependenciesOk) {
    logger.warn("Dependencies missing; exiting without starting service");
    await telemetry
      ?.shutdown()
      .catch((shutdownError: unknown) =>
        logger.error({ err: shutdownError }, "Failed to shutdown telemetry"),
      );
    process.exit(0);
  }
  await server.listen({ port: config.port, host: config.host });
  logger.info(
    {
      port: config.port,
      host: config.host,
      environment: process.env.NODE_ENV ?? "development",
    },
    `${config.service.name} started`,
  );
} catch (error) {
  logger.error({ err: error }, `Failed to start ${config.service.name}`);
  await telemetry
    ?.shutdown()
    .catch((shutdownError: unknown) =>
      logger.error({ err: shutdownError }, "Failed to shutdown telemetry"),
    );
  process.exit(1);
}

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutdown signal received");
  try {
    await server.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError: unknown) =>
        logger.error({ err: shutdownError }, "Failed to shutdown telemetry"),
      );
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
