/**
 * @fileoverview Generic type-safe caching service for Tartware core-service.
 *
 * This module provides a type-safe abstraction over Redis with automatic serialization,
 * TTL management, and batch operations. All cache operations fail gracefully if Redis
 * is unavailable, allowing the application to continue with database fallback.
 *
 * @module lib/cache
 * @category Infrastructure
 * @since 1.0.0
 *
 * **Architecture:**
 * - Type-safe operations with TypeScript generics
 * - Automatic JSON serialization/deserialization
 * - Built-in TTL (Time To Live) management
 * - Batch operations for efficiency (mget/mset)
 * - Pattern-based deletion for cache invalidation
 * - Graceful degradation when Redis unavailable
 *
 * **Key Patterns:**
 * - `user:{userId}` - User profile data
 * - `username_map:{username}` - Username to ID mapping
 * - `memberships:{userId}` - User tenant memberships
 * - `tenant:{tenantId}` - Tenant configuration
 * - `bloom:usernames` - Bloom filter bit array
 *
 * @example Basic Usage
 * ```typescript
 * import { cacheService } from './lib/cache';
 *
 * // Store data with prefix and TTL
 * await cacheService.set('123', userData, { prefix: 'user', ttl: 1800 });
 *
 * // Retrieve data
 * const cached = await cacheService.get<User>('123', { prefix: 'user' });
 * if (cached) {
 *   console.log(`Cache hit: ${cached.username}`);\n * }
 * ```
 *
 * @example Batch Operations
 * ```typescript
 * // Fetch multiple users at once
 * const userMap = await cacheService.mget<User>(['1', '2', '3'], { prefix: 'user' });
 * userMap.forEach((user, id) => {
 *   console.log(`User ${id}: ${user.username}`);\n * });
 *
 * // Store multiple entries
 * const entries = new Map([
 *   ['1', userData1],
 *   ['2', userData2]
 * ]);
 * await cacheService.mset(entries, { prefix: 'user', ttl: 1800 });
 * ```
 */

import type { Redis } from "ioredis";
import { config } from "../config.js";
import { getRedis } from "./redis.js";

/**
 * Generic cache interface
 */
export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export interface CacheEntry<T> {
  /** The actual cached data */
  data: T;
  /** Unix timestamp (milliseconds) when data was cached */
  cachedAt: number;
  /** Time To Live in seconds (optional) */
  ttl?: number;
}

/**
 * Generic cache service with type safety
 */
/**
 * Generic caching service with type-safe operations.
 *
 * Provides CRUD operations, batch operations, and TTL management for Redis cache.
 * All methods handle Redis unavailability gracefully by returning null/undefined.
 *
 * **Implementation Pattern: Lazy Redis Client Evaluation**
 *
 * This class uses lazy evaluation to obtain the Redis client on each method call
 * rather than storing it as an instance variable during construction. This pattern
 * solves the JavaScript module loading order problem where ES module imports happen
 * before the main application code executes.
 *
 * **Why Lazy Evaluation?**
 * - ES modules are loaded synchronously during import phase
 * - The singleton instance is created when `cache.ts` is imported
 * - If we stored `redis = getRedis()` in constructor, it would be called BEFORE `initRedis()`
 * - Result: redis would always be null, cache would never work
 *
 * **The Solution:**
 * - No constructor initialization of Redis client
 * - Each method calls `getRedisClient()` which evaluates `getRedis()` at runtime
 * - By the time methods are called, `initRedis()` has already executed
 * - Redis client is properly initialized and available
 *
 * **Performance Impact:**
 * - Negligible: `getRedis()` returns a cached singleton reference (~1ns)
 * - No connection overhead - Redis connection established once on startup
 * - No observable latency compared to instance variable approach
 *
 * @class CacheService
 *
 * @example Creating a specialized cache service
 * ```typescript
 * // In src/services/tenant-cache-service.ts
 * import { cacheService } from '../lib/cache';
 *
 * export class TenantCacheService {
 *   private cacheService = cacheService;
 *   private ttl = 3600; // 1 hour
 *
 *   async getTenant(tenantId: string) {
 *     const cached = await this.cacheService.get<Tenant>(`tenant:${tenantId}`);
 *     if (cached) return cached.data;
 *
 *     // Fallback to database (explicit column selection required - no SELECT *)
 *     const result = await db.query(
 *       'SELECT id, name, code, is_active, settings, created_at FROM tenants WHERE id = $1',
 *       [tenantId]
 *     );
 *     const tenant = result.rows[0];
 *     if (tenant) {
 *       await this.cacheService.set(`tenant:${tenantId}`, tenant, this.ttl);
 *     }
 *     return tenant;
 *   }
 * }
 * ```
 *
 * @example Module Loading Order Problem (OLD - BROKEN)
 * ```typescript
 * // ❌ BROKEN: This pattern fails due to module loading order
 * export class CacheService {
 *   private redis: Redis | null;
 *   constructor() {
 *     this.redis = getRedis(); // Called during module import - redis is null!
 *   }
 * }
 *
 * // Execution timeline:
 * // 1. ES modules load → import { cacheService } from './cache'
 * // 2. Singleton created → new CacheService() → getRedis() returns null
 * // 3. Application starts → main() executes
 * // 4. initRedis() called → Redis client created
 * // 5. Too late! cacheService.redis is already null
 * ```
 *
 * @example Lazy Evaluation Pattern (CURRENT - CORRECT)
 * ```typescript
 * // ✅ CORRECT: Lazy evaluation pattern
 * export class CacheService {
 *   private getRedisClient(): Redis | null {
 *     return getRedis(); // Evaluated when called, not during construction
 *   }
 *
 *   async get(key: string) {
 *     const redis = this.getRedisClient(); // Fresh evaluation each call
 *     if (!redis) return null;
 *     // ... use redis
 *   }
 * }
 *
 * // Execution timeline:
 * // 1. ES modules load → import { cacheService } from './cache'
 * // 2. Singleton created → new CacheService() (no redis evaluation yet)
 * // 3. Application starts → main() executes
 * // 4. initRedis() called → Redis client created and stored
 * // 5. Route handler calls cacheService.get()
 * // 6. getRedisClient() evaluates getRedis() → returns initialized client ✓
 * ```
 */
export class CacheService {
  /**
   * Get Redis client using lazy evaluation pattern.
   *
   * This method is called at the start of every cache operation to obtain
   * the Redis client reference. It uses lazy evaluation to avoid the module
   * loading order problem where the singleton is created before initRedis()
   * is called.
   *
   * **Technical Details:**
   * - No constructor initialization of redis client
   * - Returns fresh reference from getRedis() singleton on each call
   * - Performance: ~1ns overhead (returning cached reference)
   * - Allows Redis to be initialized AFTER module is loaded
   *
   * @private
   * @returns {Redis | null} Redis client if initialized, null otherwise
   *
   * @example Usage in cache methods
   * ```typescript
   * async get(key: string) {
   *   const redis = this.getRedisClient(); // Lazy evaluation here
   *   if (!this.isAvailable() || !redis) {
   *     return null; // Graceful degradation
   *   }
   *   return await redis.get(key);
   * }
   * ```
   */
  private getRedisClient(): Redis | null {
    return getRedis();
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.getRedisClient() !== null && config.redis.enabled;
  }

  /**
   * Generate cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  /**
   * Retrieve value from cache by key.
   *
   * Uses lazy evaluation to obtain Redis client on each call, ensuring the
   * client is initialized before use. Returns null for cache misses or errors.
   *
   * **Graceful Degradation:**
   * - Returns null if Redis not available (allows DB fallback)
   * - Returns null if key doesn't exist
   * - Returns null on deserialization errors
   *
   * @template T Type of the cached value
   * @param {string} key Cache key (will be prefixed if prefix option provided)
   * @param {CacheOptions} [options] Optional configuration (prefix, ttl)
   * @returns {Promise<T | null>} Cached value or null
   *
   * @example Basic retrieval
   * ```typescript
   * const user = await cacheService.get<User>('123', { prefix: 'user' });
   * if (user) {
   *   console.log(`Cache hit: ${user.username}`);
   * } else {
   *   console.log('Cache miss - query database');
   * }
   * ```
   *
   * @example With type safety
   * ```typescript
   * interface Product {
   *   id: string;
   *   name: string;
   *   price: number;
   * }
   *
   * const product = await cacheService.get<Product>('prod-123', { prefix: 'product' });
   * if (product) {
   *   // TypeScript knows product has id, name, price
   *   console.log(`${product.name}: $${product.price}`);
   * }
   * ```
   */
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

      const entry: CacheEntry<T> = JSON.parse(cached);
      return entry.data;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Store value in cache with automatic TTL expiration.
   *
   * Uses lazy evaluation to obtain Redis client. Serializes value to JSON and
   * wraps it in CacheEntry with metadata (cachedAt timestamp, ttl).
   *
   * **Behavior:**
   * - Returns false if Redis unavailable (allows graceful degradation)
   * - Uses default TTL from config if not specified
   * - Automatically adds keyPrefix from config (e.g., "tartware:")
   * - Overwrites existing keys without warning
   *
   * @template T Type of the value to cache
   * @param {string} key Cache key (will be prefixed if prefix option provided)
   * @param {T} value Data to cache (must be JSON serializable)
   * @param {CacheOptions} [options] Optional configuration (prefix, ttl)
   * @returns {Promise<boolean>} true if successful, false otherwise
   *
   * @example Store user data
   * ```typescript
   * const userData = { id: '123', username: 'john.doe', email: 'john@example.com' };
   * const success = await cacheService.set('123', userData, {
   *   prefix: 'user',
   *   ttl: 1800, // 30 minutes
   * });
   *
   * if (success) {
   *   console.log('User cached successfully');
   * }
   * ```
   *
   * @example Store with default TTL
   * ```typescript
   * // Uses config.redis.ttl.default (typically 3600s)
   * await cacheService.set('session-abc', sessionData, { prefix: 'session' });
   * ```
   */
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
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
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
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   */
  async delPattern(pattern: string, options?: CacheOptions): Promise<number> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis) {
      return 0;
    }

    try {
      const fullPattern = this.buildKey(pattern, options?.prefix);
      const keys = await redis.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      // Remove prefix from keys as Redis client adds it automatically
      const keysWithoutPrefix = keys.map((key) =>
        key.replace(config.redis.keyPrefix, ""),
      );

      await redis.del(...keysWithoutPrefix);
      return keys.length;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[], options?: CacheOptions): Promise<Map<string, T>> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis || keys.length === 0) {
      return new Map();
    }

    try {
      const fullKeys = keys.map((key) => this.buildKey(key, options?.prefix));
      const values = await redis.mget(...fullKeys);

      const result = new Map<string, T>();
      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            const entry: CacheEntry<T> = JSON.parse(value);
            result.set(key, entry.data);
          } catch {
            // Skip invalid entries
          }
        }
      });

      return result;
    } catch (error) {
      console.error("Cache mget error:", error);
      return new Map();
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(entries: Map<string, T>, options?: CacheOptions): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis || entries.size === 0) {
      return false;
    }

    try {
      const pipeline = redis.pipeline();
      const ttl = options?.ttl ?? config.redis.ttl.default;

      for (const [key, value] of entries) {
        const fullKey = this.buildKey(key, options?.prefix);
        const entry: CacheEntry<T> = {
          data: value,
          cachedAt: Date.now(),
          ttl,
        };
        pipeline.setex(fullKey, ttl, JSON.stringify(entry));
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error("Cache mset error:", error);
      return false;
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string, options?: CacheOptions): Promise<number> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis) {
      return 0;
    }

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      return await redis.incr(fullKey);
    } catch (error) {
      console.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string, options?: CacheOptions): Promise<number> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis) {
      return -2;
    }

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      return await redis.ttl(fullKey);
    } catch (error) {
      console.error(`Cache ttl error for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Extend TTL for key
   */
  async expire(key: string, ttl: number, options?: CacheOptions): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!this.isAvailable() || !redis) {
      return false;
    }

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();
