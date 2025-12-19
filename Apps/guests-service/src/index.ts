import process from "node:process";

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
    "@opentelemetry/instrumentation-pg": {
      enabled: true,
    },
  },
});

const app = buildServer();

const start = async () => {
  try {
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
      .catch((shutdownError) =>
        app.log.error(shutdownError, "failed to shutdown telemetry"),
      );
    process.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutdown signal received");
  try {
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
