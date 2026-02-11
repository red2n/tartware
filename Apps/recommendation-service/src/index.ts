import process from "node:process";

import { ensureDependencies, resolveOtelDependency } from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";

import { config } from "./config.js";
import { closePool } from "./lib/db.js";
import { buildServer } from "./server.js";
import { initializePipeline } from "./services/index.js";

const telemetry = await initTelemetry({
  serviceName: config.service.name,
  serviceVersion: config.service.version,
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
let isShuttingDown = false;

const otelDependency = resolveOtelDependency(true);
const dependenciesOk = await ensureDependencies(
  [
    { name: "PostgreSQL", host: config.db.host, port: config.db.port },
    ...(otelDependency ? [otelDependency] : []),
  ],
  { logger: app.log },
);

if (!dependenciesOk) {
  app.log.warn("Dependencies missing; exiting without starting service");
  await telemetry
    ?.shutdown()
    .catch((telemetryError: unknown) =>
      app.log.error(telemetryError, "Failed to shutdown telemetry"),
    );
  proc?.exit(0);
}

initializePipeline();

app
  .listen({ port: config.port, host: config.host })
  .then(() => {
    app.log.info(
      {
        port: config.port,
        host: config.host,
        environment: config.nodeEnv,
      },
      `${config.service.name} listening`,
    );
  })
  .catch(async (error: unknown) => {
    app.log.error(error, `Failed to start ${config.service.name}`);
    await closePool();
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((telemetryError: unknown) =>
        app.log.error(telemetryError, "Failed to shutdown telemetry after startup failure"),
      );
    proc?.exit(1);
  });

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    app.log.info({ signal }, "Shutdown already in progress");
    return;
  }
  isShuttingDown = true;
  app.log.info({ signal }, "Received shutdown signal");
  try {
    await closePool();
    await telemetry
      ?.shutdown()
      .catch((telemetryError: unknown) =>
        app.log.error(telemetryError, "Failed to shutdown telemetry"),
      );
    await app.close();
    proc?.exit(0);
  } catch (error) {
    app.log.error(error, "Error during shutdown");
    proc?.exit(1);
  }
};

if (proc && "on" in proc && typeof proc.on === "function") {
  proc.on("SIGTERM", () => shutdown("SIGTERM"));
  proc.on("SIGINT", () => shutdown("SIGINT"));
}
