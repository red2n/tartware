/**
 * @fileoverview Redis client initialization and lifecycle management for Tartware core-service.
 *
 * This module provides a singleton Redis client with automatic reconnection, health checks,
 * and graceful error handling. Redis is used for caching user data, Bloom filters, and
 * reducing database load.
 *
 * @module lib/redis
 * @category Infrastructure
 * @since 1.0.0
 *
 * @example
 * ```typescript
 * // Initialize Redis on application startup
 * const redis = initRedis();
 * if (redis) {
 *   console.log('Redis connected successfully');
 * }
 *
 * // Get Redis client anywhere in the application
 * const client = getRedis();
 * if (client) {
 *   await client.set('key', 'value');
 * }
 *
 * // Check health status
 * const healthy = isRedisHealthy();
 * console.log(`Redis status: ${healthy ? 'healthy' : 'unavailable'}`);
 *
 * // Graceful shutdown
 * await closeRedis();
 * ```
 */

import Redis from "ioredis";

import { config } from "../config.js";

/**
 * Singleton Redis client instance.
 * Null if Redis is not initialized or connection failed.
 * @private
 */
let redisClient: Redis | null = null;

/**
 * Initialize Redis client connection
 */
/**
 * Initializes the Redis client with configuration from config.ts.
 *
 * This function should be called once during application startup. It creates a singleton
 * Redis client with automatic reconnection and error handling. If Redis is disabled in
 * config or connection fails, the application continues to work (degraded mode - no caching).
 *
 * **Retry Strategy:**
 * - Attempts reconnection up to 10 times
 * - Exponential backoff: min(retryAttempt * 50ms, 2000ms)
 * - After 10 failed attempts, stops retrying
 *
 * **Event Handling:**
 * - `connect`: Logs successful connection
 * - `ready`: Confirms client is ready to accept commands
 * - `error`: Logs errors but doesn't crash the application
 * - `close`: Logs disconnection events
 *
 * @returns {Redis | null} Redis client instance if successful, null if disabled or failed
 *
 * @example
 * ```typescript
 * // In src/index.ts (application startup)
 * const redis = initRedis();
 * if (redis) {
 *   app.log.info('Redis caching enabled');
 *   // Warm up Bloom filters
 *   await userCacheService.warmBloomFilter();
 * } else {
 *   app.log.warn('Redis unavailable - running without cache');
 * }
 * ```
 *
 * @see {@link config.redis} for configuration options
 * @see {@link getRedis} to retrieve the client instance
 */
export const initRedis = (): Redis | null => {
  if (!config.redis.enabled) {
    console.log("Redis is disabled via configuration");
    return null;
  }

  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      keyPrefix: config.redis.keyPrefix,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on("connect", () => {
      console.log("✓ Redis connected");
    });

    redisClient.on("error", (error) => {
      console.error("Redis error:", error);
    });

    redisClient.on("close", () => {
      console.log("Redis connection closed");
    });

    return redisClient;
  } catch (error) {
    console.error("Failed to initialize Redis:", error);
    return null;
  }
};

/**
 * Get Redis client instance
 */
export const getRedis = (): Redis | null => {
  return redisClient;
};

/**
 * Close Redis connection
 */
/**
 * Gracefully closes the Redis connection.
 *
 * This function should be called during application shutdown (SIGTERM/SIGINT handlers).
 * It ensures all pending commands are completed before closing the connection.
 *
 * @returns {Promise<void>} Resolves when connection is closed
 *
 * @example
 * ```typescript
 * // In src/index.ts (shutdown handler)
 * process.on('SIGTERM', async () => {
 *   app.log.info('Shutting down gracefully...');
 *   await closeRedis();
 *   await app.close();
 *   process.exit(0);
 * });
 * ```
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

/**
 * Health check for Redis connection
 */
export const isRedisHealthy = async (): Promise<boolean> => {
  if (!redisClient) {
    return false;
  }

  try {
    const response = await redisClient.ping();
    return response === "PONG";
  } catch {
    return false;
  }
};
