import Redis from "ioredis";

import { config } from "../config.js";

import { appLogger } from "./logger.js";

const redisLogger = appLogger.child({ module: "redis" });

let redisClient: Redis | null = null;

export const initRedis = (): Redis | null => {
  if (!config.redis.enabled) {
    redisLogger.info("Redis is disabled via configuration");
    return null;
  }

  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on("connect", () => {
      redisLogger.info("Redis connected");
    });

    redisClient.on("error", (error) => {
      redisLogger.error({ err: error }, "Redis error");
    });

    redisClient.on("close", () => {
      redisLogger.info("Redis connection closed");
    });

    return redisClient;
  } catch (error) {
    redisLogger.error({ err: error }, "Failed to initialize Redis");
    return null;
  }
};

export const getRedis = (): Redis | null => redisClient;

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};
