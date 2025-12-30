import process from "node:process";

import {
  ensureDependencies,
  parseHostPort,
  resolveOtelDependency,
} from "@tartware/config";
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

const SHUTDOWN_TIMEOUT_MS = 5_000;
const SHUTDOWN_GRACE_MS = 2_000;
let shuttingDown = false;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms).unref();
  });

const start = async () => {
  try {
    app.log.info("Starting Availability Guard service startup");
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

    app.log.info("Dependencies available; starting HTTP server");

    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      {
        port: config.port,
        host: config.host,
        shadowMode: config.guard.shadowMode,
      },
      "Availability Guard service started",
    );
  } catch (error) {
    app.log.error(error, "Failed to start Availability Guard service");
    await telemetry
      ?.shutdown()
      .catch((shutdownError) =>
        app.log.error(shutdownError, "Failed to shutdown telemetry"),
      );
    process.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    app.log.warn({ signal }, "shutdown already in progress");
    return;
  }
  shuttingDown = true;

  app.log.info({ signal }, "shutdown signal received");

  const forceExitTimer = setTimeout(() => {
    app.log.error(
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
      "Force exiting availability-guard after shutdown timeout",
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  try {
    app.log.info("Closing fastify instance");
    const closePromise = app.close().catch((error) => {
      app.log.error(error, "Fastify close rejected");
    });

    await Promise.race([closePromise, delay(SHUTDOWN_GRACE_MS)]);
    void closePromise.catch(() => undefined);

    const telemetryShutdown = telemetry?.shutdown();
    if (telemetryShutdown) {
      await Promise.race([
        telemetryShutdown.catch((error) =>
          app.log.error(error, "Failed to shutdown telemetry"),
        ),
        delay(1_000),
      ]);
    }

    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    app.log.error(error, "error during shutdown");
    process.exit(1);
  }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start();
