import { Redis } from "ioredis";

import { gatewayConfig } from "../config.js";
import { gatewayLogger } from "../logger.js";

let sharedClient: Redis | null = null;
let connectionFailed = false;

/**
 * Returns the shared gateway Redis client.
 * Returns `null` when Redis is disabled or the initial connection failed.
 */
export const getRedisClient = (): Redis | null => sharedClient;

/**
 * Initialise the shared Redis connection.
 * Called once during server startup; safe to call multiple times (idempotent).
 */
export const initRedisClient = async (): Promise<Redis | null> => {
  if (sharedClient) return sharedClient;
  if (connectionFailed) return null;
  if (!gatewayConfig.redis.enabled) return null;

  const client = new Redis({
    host: gatewayConfig.redis.host,
    port: gatewayConfig.redis.port,
    password: gatewayConfig.redis.password,
    db: gatewayConfig.redis.db,
    keyPrefix: gatewayConfig.redis.keyPrefix,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on("error", (err: Error) => {
    gatewayLogger.warn({ err }, "Redis client error");
  });

  try {
    await client.connect();
    gatewayLogger.info("Shared Redis client connected");
    sharedClient = client;
    return client;
  } catch {
    gatewayLogger.warn("Redis client failed to connect; features will fall back to in-memory");
    connectionFailed = true;
    return null;
  }
};

/** Gracefully close the shared Redis connection. */
export const shutdownRedisClient = async (): Promise<void> => {
  if (sharedClient) {
    await sharedClient.quit().catch(() => {});
    sharedClient = null;
  }
};
