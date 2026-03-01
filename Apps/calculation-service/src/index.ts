import process from "node:process";

import { resolveOtelDependency } from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";

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
  },
});

const app = buildServer();
const proc = process;

const start = async () => {
  try {
    const telemetryDependency = resolveOtelDependency(true);
    if (telemetryDependency) {
      app.log.debug({ dependency: telemetryDependency.name }, "OTel collector configured");
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
      .catch((shutdownError) => app.log.error(shutdownError, "failed to shutdown telemetry"));
    proc?.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutdown signal received");
  try {
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
