import { config } from "./config.js";
import { closeRedis, initRedis } from "./lib/redis.js";
import { buildServer } from "./server.js";
import { userCacheService } from "./services/user-cache-service.js";

const app = buildServer();
const proc = (globalThis as { process?: { exit(code?: number): void } }).process;

// Initialize Redis
const redis = initRedis();

app
  .listen({ port: config.port, host: config.host })
  .then(async () => {
    app.log.info({ port: config.port, host: config.host }, "core-service listening");

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
    app.log.error(error, "failed to start core-service");
    await closeRedis();
    await app.close();
    proc?.exit(1);
  });

// Graceful shutdown
const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Received shutdown signal");
  try {
    await closeRedis();
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
