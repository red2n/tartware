import process from "node:process";

import { ensureDependencies, resolveOtelDependency } from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";

import { config } from "./config.js";
import { closeRedis, initRedis } from "./lib/redis.js";
import { buildServer } from "./server.js";
import { userCacheService } from "./services/user-cache-service.js";

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
    "@opentelemetry/instrumentation-ioredis": {
      enabled: true,
    },
  },
});
const app = buildServer();
const proc: typeof process | undefined = process;
let isShuttingDown = false;

const otelDependency = resolveOtelDependency(true);
const dependenciesOk = await ensureDependencies(
  [
    { name: "PostgreSQL", host: config.db.host, port: config.db.port },
    ...(config.redis.enabled
      ? [
          {
            name: "Redis",
            host: config.redis.host,
            port: config.redis.port,
          },
        ]
      : []),
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
  if (proc) {
    proc.exit(0);
  }
}

// Initialize Redis
const redis = initRedis();

app
  .listen({ port: config.port, host: config.host })
  .then(async () => {
    app.log.info({ port: config.port, host: config.host }, `${config.service.name} listening`);

    // Warm up Bloom filter with existing usernames
    if (redis) {
      try {
        const count = await userCacheService.warmBloomFilter();
        app.log.info({ count }, "Bloom filter warmed up with usernames");
      } catch (error) {
        app.log.error(error, "Failed to warm up Bloom filter");
      }
    }
  })
  .catch(async (error: unknown) => {
    app.log.error(error, `failed to start ${config.service.name}`);
    await closeRedis();
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((telemetryError) =>
        app.log.error(telemetryError, "Failed to shutdown telemetry after startup failure"),
      );
    proc?.exit(1);
  });

// Graceful shutdown
const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    app.log.info({ signal }, "Shutdown already in progress");
    return;
  }
  isShuttingDown = true;
  app.log.info({ signal }, "Received shutdown signal");
  try {
    await closeRedis();
    await telemetry
      ?.shutdown()
      .catch((telemetryError) =>
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
