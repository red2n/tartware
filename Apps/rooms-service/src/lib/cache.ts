import type { Redis } from "ioredis";

import { config } from "../config.js";

import { appLogger } from "./logger.js";
import { getRedis } from "./redis.js";

const cacheLogger = appLogger.child({ module: "cache" });

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

type CacheEntry<T> = {
  data: T;
  cachedAt: number;
  ttl?: number;
};

export class CacheService {
  private getRedisClient(): Redis | null {
    return getRedis();
  }

  isAvailable(): boolean {
    return this.getRedisClient() !== null && config.redis.enabled;
  }

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis) {
      return null;
    }

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const cached = await redis.get(fullKey);
      if (!cached) {
        return null;
      }

      const entry = JSON.parse(cached) as CacheEntry<T>;
      return entry.data;
    } catch (error) {
      cacheLogger.error({ err: error, key }, "Cache get error");
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl ?? config.redis.ttl.default;
      const entry: CacheEntry<T> = {
        data: value,
        cachedAt: Date.now(),
        ttl,
      };

      await redis.setex(fullKey, ttl, JSON.stringify(entry));
      return true;
    } catch (error) {
      cacheLogger.error({ err: error, key }, "Cache set error");
      return false;
    }
  }

  async del(key: string, options?: CacheOptions): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      await redis.del(fullKey);
      return true;
    } catch (error) {
      cacheLogger.error({ err: error, key }, "Cache delete error");
      return false;
    }
  }
}

export const cacheService = new CacheService();
