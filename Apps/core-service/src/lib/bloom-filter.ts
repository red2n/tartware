/**
 * @fileoverview Bloom filter implementation for efficient existence checks in Tartware.
 *
 * This module provides a space-efficient probabilistic data structure to test whether
 * an element is a member of a set. It's used to reduce database queries by quickly
 * determining if a username/tenant ID likely exists before querying the database.
 *
 * @module lib/bloom-filter
 * @category Infrastructure
 * @since 1.0.0
 *
 * **How Bloom Filters Work:**
 * - Uses multiple hash functions to map elements to bit array positions
 * - `add()`: Sets multiple bits to 1 for each element
 * - `mightExist()`: Checks if all corresponding bits are 1
 * - **False positives possible** (says yes when no): ~1% with good configuration
 * - **False negatives impossible** (never says no when yes): 100% accurate for negatives
 *
 * **Performance Characteristics:**
 * - Space: O(m) where m = bit array size
 * - Time: O(k) where k = number of hash functions
 * - Query: O(1) - constant time lookups
 * - Memory: 100k bits = 12.5KB (UsernameBloomFilter)
 *
 * **Use Cases:**
 * - Pre-check usernames before database query (saves DB load)
 * - Pre-check tenant IDs before expensive lookups
 * - Rate limiting (check if IP seen before)
 * - Duplicate detection in batch operations
 *
 * @example Basic Usage
 * ```typescript
 * import { usernameBloomFilter } from './lib/bloom-filter';
 *
 * // Add existing usernames to filter
 * await usernameBloomFilter.addBatch(['john.doe', 'jane.smith', 'bob.wilson']);
 *
 * // Check if username might exist (fast check)
 * const mightExist = await usernameBloomFilter.mightExist('john.doe');
 * if (!mightExist) {
 *   // Definitely doesn't exist - no DB query needed
 *   return null;
 * }
 *
 * // Might exist - verify with DB query (explicit columns required - no SELECT *)
 * const result = await db.query(
 *   'SELECT id, username, email, first_name, last_name, is_active FROM users WHERE username = $1',
 *   ['john.doe']
 * );
 * const user = result.rows[0];
 * ```
 *
 * @example Three-Layer Lookup Pattern
 * ```typescript
 * async function getUserByUsername(username: string) {
 *   // Layer 1: Bloom filter (fastest - O(1) memory check)
 *   const mightExist = await usernameBloomFilter.mightExist(username);
 *   if (!mightExist) {
 *     console.log('Bloom filter: username definitely does not exist');
 *     return null; // Saved a DB query!
 *   }
 *
 *   // Layer 2: Redis cache (fast - O(1) network check)
 *   const cached = await cacheService.get(`user:${username}`);
 *   if (cached) {
 *     console.log('Cache hit');
 *     return cached;
 *   }
 *
 *   // Layer 3: Database (slowest - disk I/O)
 *   const result = await db.query(
 *     'SELECT id, username, email, first_name, last_name, is_active FROM users WHERE username = $1',
 *     [username]
 *   );
 *   const user = result.rows[0];
 *   if (user) {
 *     // Populate cache for next time
 *     await cacheService.set(`user:${username}`, user, 1800);
 *   }
 *   return user;
 * }
 * ```
 */

import type { Redis } from "ioredis";

import { config } from "../config.js";

import { getRedis } from "./redis.js";

/**
 * Bloom Filter implementation using Redis for persistent storage.
 *
 * A probabilistic data structure for testing set membership with minimal memory.
 * Uses multiple hash functions and a bit array stored in Redis.
 *
 * **Trade-offs:**
 * - False positive rate: ~1% (configurable via hashFunctions and bitArraySize)
 * - False negative rate: 0% (never says "no" when answer is "yes")
 * - Memory usage: bitArraySize / 8 bytes
 *
 * @class BloomFilter
 *
 * @example Creating a custom Bloom filter
 * ```typescript
 * const emailFilter = new BloomFilter('emails', {
 *   hashFunctions: 5,
 *   bitArraySize: 50000
 * });
 *
 * await emailFilter.add('user@example.com');
 * const exists = await emailFilter.mightExist('user@example.com'); // true
 * const notExists = await emailFilter.mightExist('other@example.com'); // false
 * ```
 */
export class BloomFilter {
  private readonly filterKey: string;
  private readonly hashFunctions: number;
  private readonly bitArraySize: number;
  private initialized = false;

  constructor(filterKey: string, options?: { hashFunctions?: number; bitArraySize?: number }) {
    this.filterKey = `bloom:${filterKey}`;
    this.hashFunctions = options?.hashFunctions ?? 3;
    this.bitArraySize = options?.bitArraySize ?? 10000;
  }

  private getRedisClient(): Redis | null {
    if (!config.redis.enabled) {
      return null;
    }
    return getRedis();
  }

  private async ensureInitialized(redis: Redis): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    try {
      const exists = await redis.exists(this.filterKey);
      this.initialized = exists === 1;
      return this.initialized;
    } catch (error) {
      console.error("Bloom filter exists check failed:", error);
      return false;
    }
  }

  /**
   * Check if Bloom filter is available
   */
  isAvailable(): boolean {
    return this.getRedisClient() !== null;
  }

  /**
   * Hash function generator
   */
  private hash(value: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash % this.bitArraySize);
  }

  /**
   * Add item to Bloom filter
   */
  async add(value: string): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!redis) {
      return false;
    }

    try {
      const pipeline = redis.pipeline();

      for (let i = 0; i < this.hashFunctions; i++) {
        const bitPosition = this.hash(value, i);
        pipeline.setbit(this.filterKey, bitPosition, 1);
      }

      await pipeline.exec();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`Bloom filter add error for ${value}:`, error);
      return false;
    }
  }

  /**
   * Check if item might exist in Bloom filter
   * Returns: true = might exist (check database), false = definitely doesn't exist
   */
  async mightExist(value: string): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!redis) {
      return true; // Fail open - check database if Redis unavailable
    }

    try {
      if (!(await this.ensureInitialized(redis))) {
        return true;
      }

      const pipeline = redis.pipeline();

      for (let i = 0; i < this.hashFunctions; i++) {
        const bitPosition = this.hash(value, i);
        pipeline.getbit(this.filterKey, bitPosition);
      }

      const results = await pipeline.exec();

      if (!results) {
        return true;
      }

      // All bits must be set for potential match
      return results.every((result) => result[1] === 1);
    } catch (error) {
      console.error(`Bloom filter check error for ${value}:`, error);
      return true; // Fail open
    }
  }

  /**
   * Add multiple items to Bloom filter
   */
  async addBatch(values: string[]): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!redis || values.length === 0) {
      return false;
    }

    try {
      const pipeline = redis.pipeline();

      for (const value of values) {
        for (let i = 0; i < this.hashFunctions; i++) {
          const bitPosition = this.hash(value, i);
          pipeline.setbit(this.filterKey, bitPosition, 1);
        }
      }

      await pipeline.exec();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error("Bloom filter batch add error:", error);
      return false;
    }
  }

  /**
   * Clear Bloom filter
   */
  async clear(): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!redis) {
      return false;
    }

    try {
      await redis.del(this.filterKey);
      this.initialized = false;
      return true;
    } catch (error) {
      console.error("Bloom filter clear error:", error);
      return false;
    }
  }

  /**
   * Check if filter exists
   */
  async exists(): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!redis) {
      return false;
    }

    try {
      const result = await redis.exists(this.filterKey);
      return result === 1;
    } catch (error) {
      console.error("Bloom filter exists error:", error);
      return false;
    }
  }

  /**
   * Set expiration on filter
   */
  async expire(ttl: number): Promise<boolean> {
    const redis = this.getRedisClient();
    if (!redis) {
      return false;
    }

    try {
      const result = await redis.expire(this.filterKey, ttl);
      return result === 1;
    } catch (error) {
      console.error("Bloom filter expire error:", error);
      return false;
    }
  }
}

/**
 * Username Bloom Filter - specialized for username existence checks
 */
export class UsernameBloomFilter extends BloomFilter {
  private static instance: UsernameBloomFilter;

  private constructor() {
    super("usernames", {
      hashFunctions: 4,
      bitArraySize: 100000, // Support ~10k usernames with <1% false positive rate
    });
  }

  public static getInstance(): UsernameBloomFilter {
    if (!UsernameBloomFilter.instance) {
      UsernameBloomFilter.instance = new UsernameBloomFilter();
    }
    return UsernameBloomFilter.instance;
  }
}

// Singleton instance
export const usernameBloomFilter = UsernameBloomFilter.getInstance();
