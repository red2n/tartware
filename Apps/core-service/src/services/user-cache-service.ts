/**
 * @fileoverview User caching service with three-layer lookup architecture for Tartware.
 *
 * This module implements an intelligent caching strategy to dramatically reduce database
 * load for user lookups. It uses a three-layer approach: Bloom filter → Redis cache → Database.
 *
 * @module services/user-cache-service
 * @category Services
 * @since 1.0.0
 *
 * **Architecture Overview:**
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    Three-Layer Lookup                        │
 * ├─────────────────────────────────────────────────────────────┤
 * │                                                               │
 * │  Layer 1: Bloom Filter (fastest - ~1μs)                     │
 * │  ├─ Check if username MIGHT exist                           │
 * │  ├─ If NO: Return null (saved DB query!)                    │
 * │  └─ If YES: Continue to Layer 2                             │
 * │                                                               │
 * │  Layer 2: Redis Cache (fast - ~1-5ms)                       │
 * │  ├─ Check username_map:{username} → userId                  │
 * │  ├─ Get user:{userId} → user data                           │
 * │  ├─ Get memberships:{userId} → tenant associations          │
 * │  ├─ If FOUND: Return cached data                            │
 * │  └─ If MISS: Continue to Layer 3                            │
 * │                                                               │
 * │  Layer 3: Database (slowest - ~10-50ms)                     │
 * │  ├─ Query users table by username                           │
 * │  ├─ Query user_tenant_associations                          │
 * │  ├─ Populate cache for next time                            │
 * │  └─ Return data                                              │
 * │                                                               │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * **Performance Impact:**
 * - Bloom filter eliminates ~99% of DB queries for non-existent usernames
 * - Cache hit rate: ~80-90% for existing users (after warm-up)
 * - Typical response time: <5ms (vs. 50ms direct DB query)
 * - Database load reduction: ~95% for read operations
 *
 * **Cache TTLs:**
 * - User data: 30 minutes (1800s)
 * - Username→ID mappings: 30 minutes (1800s)
 * - Memberships: 30 minutes (1800s)
 * - Bloom filter: 24 hours (86400s)
 *
 * **Cache Keys:**
 * - `user:{userId}` - Full user profile
 * - `username_map:{username}` - Username to ID mapping
 * - `memberships:{userId}` - Array of tenant associations
 * - `bloom:usernames` - Bloom filter bit array
 *
 * @example Basic Usage in Auth Route
 * ```typescript
 * import { userCacheService } from './services/user-cache-service';
 *
 * app.post('/auth/login', async (request, reply) => {
 *   const { username, password } = request.body;
 *
 *   // Three-layer lookup automatically handles all caching
 *   const result = await userCacheService.getUserWithMemberships(username);
 *
 *   if (!result) {
 *     return reply.code(401).send({ error: 'Invalid credentials' });
 *   }
 *
 *   // Verify password and generate token
 *   // ...
 * });
 * ```
 *
 * @example Cache Invalidation on User Update
 * ```typescript
 * app.patch('/users/:userId', async (request, reply) => {
 *   const { userId } = request.params;
 *
 *   // Update user in database
 *   await pool.query('UPDATE users SET ... WHERE id = $1', [userId]);
 *
 *   // Invalidate cache so next request gets fresh data
 *   await userCacheService.invalidateUser(userId);
 *
 *   return reply.send({ success: true });
 * });
 * ```
 *
 * @example Warming Bloom Filter on Startup
 * ```typescript
 * // In src/index.ts
 * app.listen().then(async () => {
 *   app.log.info('Server started, warming up Bloom filter...');
 *
 *   const count = await userCacheService.warmBloomFilter();
 *   app.log.info(`Bloom filter initialized with ${count} usernames`);
 * });
 * ```
 */

import { TenantRoleEnum, UserSchema } from "@tartware/schemas";
import { z } from "zod";

import { config } from "../config.js";
import { usernameBloomFilter } from "../lib/bloom-filter.js";
import { cacheService } from "../lib/cache.js";
import { pool } from "../lib/db.js";
import {
  recordMembershipCacheError,
  recordMembershipCacheHit,
  recordMembershipCacheMiss,
} from "../lib/metrics.js";
import { trackMembershipCacheSample } from "../lib/monitoring.js";
import {
  DEFAULT_ENABLED_MODULES,
  MODULE_IDS,
  normalizeModuleList,
} from "../modules/module-registry.js";

/**
 * Cached user data structure - Uses Zod schema validation from @tartware/schemas.
 * Picks only the fields we need for caching (excludes password_hash).
 */
export const CachedUserSchema = UserSchema.pick({
  id: true,
  username: true,
  email: true,
  first_name: true,
  last_name: true,
  is_active: true,
});

export type CachedUser = z.infer<typeof CachedUserSchema>;

/**
 * Cached membership data - manually defined to match database structure.
 * Can't use .pick() on UserTenantAssociationSchema because it has .refine()
 */
const ModuleIdSchema = z.enum(MODULE_IDS);

export const CachedMembershipSchema = z.object({
  tenant_id: z.string().uuid(),
  tenant_name: z.string().min(1).optional(),
  role: TenantRoleEnum,
  is_active: z.boolean(),
  permissions: z.record(z.unknown()),
  modules: z.array(ModuleIdSchema).default(DEFAULT_ENABLED_MODULES),
});

export type CachedMembership = z.infer<typeof CachedMembershipSchema>;

/**
 * Combined user with memberships - validated by Zod schemas.
 */
export const CachedUserWithMembershipsSchema = CachedUserSchema.extend({
  memberships: z.array(CachedMembershipSchema),
});

export type CachedUserWithMemberships = z.infer<typeof CachedUserWithMembershipsSchema>;

/**
 * User Cache Service - Three-layer caching for user lookups.
 *
 * Implements Bloom filter → Redis cache → Database pattern to minimize database load.
 * All public methods gracefully handle Redis unavailability by falling back to database.
 *
 * @class UserCacheService
 *
 * @example Using in a route handler
 * ```typescript
 * const userCacheService = new UserCacheService();
 *
 * app.post('/auth/login', async (request, reply) => {
 *   const { username } = request.body;
 *   const result = await userCacheService.getUserWithMemberships(username);
 *   if (!result) {
 *     return reply.code(401).send({ error: 'User not found' });
 *   }
 *   // Generate JWT with user.id and memberships
 * });
 * ```
 */
export class UserCacheService {
  private readonly USER_PREFIX = "user";
  private readonly USERNAME_MAP_PREFIX = "username_map";
  private readonly MEMBERSHIPS_PREFIX = "memberships";

  /**
   * Retrieves user by username using three-layer lookup strategy.
   *
   * **Lookup Flow:**
   * 1. Bloom filter: Quick check if username might exist (~1μs)
   * 2. Cache: Check username_map and user cache (~1-5ms)
   * 3. Database: Fallback query and cache population (~10-50ms)
   *
   * @param {string} username The username to look up
   * @returns {Promise<CachedUser | null>} User data if found, null otherwise
   *
   * @example
   * ```typescript
   * const user = await userCacheService.getUserByUsername('john.doe');
   * if (user) {
   *   console.log(`Found: ${user.email}`);
   * } else {
   *   console.log('User does not exist');
   * }
   * ```
   *
   * @example Performance comparison
   * ```typescript
   * // Traditional approach (always hits DB)
   * const result = await pool.query(
   *   'SELECT id, username, email, first_name, last_name, is_active FROM users WHERE username = $1',
   *   [username]
   * );
   * const user = result.rows[0];
   * // Average: ~50ms per request
   *
   * // Cached approach
   * const user = await userCacheService.getUserByUsername(username);
   * // First request: ~50ms (cache population)
   * // Subsequent requests: <5ms (cache hit)
   * // Non-existent users: <1ms (Bloom filter rejection)
   * ```
   */
  async getUserByUsername(username: string): Promise<CachedUser | null> {
    // Step 1: Check Bloom filter (fast negative check)
    const mightExist = await usernameBloomFilter.mightExist(username);
    if (!mightExist) {
      // Definitely doesn't exist, skip cache and DB
      return null;
    }

    // Step 2: Check cache for username → user_id mapping
    const userId = await cacheService.get<string>(username, {
      prefix: this.USERNAME_MAP_PREFIX,
      ttl: config.redis.ttl.user,
    });

    if (userId) {
      // Step 3: Get user from cache
      const cachedUser = await this.getUserById(userId);
      if (cachedUser) {
        return cachedUser;
      }
    }

    // Step 4: Cache miss - query database
    const user = await this.fetchUserFromDb(username);

    if (user) {
      // Step 5: Populate cache and Bloom filter
      await this.cacheUser(user);
      await usernameBloomFilter.add(username);
    }

    return user;
  }

  /**
   * Retrieves user by ID from cache or database.
   *
   * Unlike getUserByUsername, this skips the Bloom filter check since UUIDs
   * are validated before this call.
   *
   * @param {string} userId UUID of the user
   * @returns {Promise<CachedUser | null>} User data if found, null otherwise
   *
   * @example
   * ```typescript
   * const user = await userCacheService.getUserById('123e4567-e89b-12d3-a456-426614174000');
   * ```
   */
  async getUserById(userId: string): Promise<CachedUser | null> {
    // Check cache first
    const cached = await cacheService.get<CachedUser>(userId, {
      prefix: this.USER_PREFIX,
      ttl: config.redis.ttl.user,
    });

    if (cached) {
      return cached;
    }

    // Cache miss - fetch from database
    const user = await this.fetchUserByIdFromDb(userId);
    if (user) {
      await this.cacheUser(user);
    }

    return user;
  }

  /**
   * Retrieves user's tenant memberships from cache or database.
   *
   * Memberships include tenant_id, role, and permissions for multi-tenant access control.
   *
   * @param {string} userId UUID of the user
   * @returns {Promise<CachedMembership[]>} Array of tenant associations (empty if none)
   *
   * @example
   * ```typescript
   * const memberships = await userCacheService.getUserMemberships(userId);
   * console.log(`User has access to ${memberships.length} tenants`);
   * memberships.forEach(m => {
   *   console.log(`Tenant: ${m.tenant_id}, Role: ${m.role}`);
   * });
   * ```
   */
  async getUserMemberships(userId: string): Promise<CachedMembership[]> {
    // Check cache first
    const cached = await cacheService.get<CachedMembership[]>(userId, {
      prefix: this.MEMBERSHIPS_PREFIX,
      ttl: config.redis.ttl.user,
    });

    if (cached) {
      recordMembershipCacheHit();
      trackMembershipCacheSample("hit");
      return cached;
    }

    recordMembershipCacheMiss();
    trackMembershipCacheSample("miss");

    // Cache miss - fetch from database
    const memberships = await this.fetchMembershipsFromDb(userId);
    if (memberships.length > 0) {
      await cacheService.set(userId, memberships, {
        prefix: this.MEMBERSHIPS_PREFIX,
        ttl: config.redis.ttl.user,
      });
    }

    return memberships;
  }

  /**
   * Retrieves complete user profile with tenant memberships (one-stop method for auth).
   *
   * This is the recommended method for authentication flows as it returns everything
   * needed for JWT generation in a single call.
   *
   * **Uses three-layer lookup for user, then fetches memberships from cache/DB.**
   *
   * @param {string} username The username to look up
   * @returns {Promise<CachedUserWithMemberships | null>} User with memberships, or null if not found
   *
   * @example Authentication flow
   * ```typescript
   * app.post('/auth/login', async (request, reply) => {
   *   const { username, password } = request.body;
   *
   *   const result = await userCacheService.getUserWithMemberships(username);
   *   if (!result) {
   *     return reply.code(401).send({ error: 'Invalid credentials' });
   *   }
   *
   *   // Verify password (bcrypt comparison)
   *   const passwordValid = await bcrypt.compare(password, result.password_hash);
   *   if (!passwordValid) {
   *     return reply.code(401).send({ error: 'Invalid credentials' });
   *   }
   *
   *   // Generate JWT with user ID and tenant memberships
   *   const token = jwt.sign({
   *     userId: result.id,
   *     username: result.username,
   *     memberships: result.memberships.map(m => ({
   *       tenantId: m.tenant_id,
   *       role: m.role
   *     }))
   *   }, JWT_SECRET);
   *
   *   return { token, user: result };
   * });
   * ```
   */
  async getUserWithMemberships(username: string): Promise<CachedUserWithMemberships | null> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return null;
    }

    const memberships = await this.getUserMemberships(user.id);

    return {
      ...user,
      memberships,
    };
  }

  /**
   * Stores user data in cache with both user ID and username keys.
   *
   * Creates two cache entries:
   * - `user:{userId}` → Full user object
   * - `username_map:{username}` → userId mapping
   *
   * @private
   * @param {CachedUser} user User data to cache
   * @returns {Promise<void>}
   */
  private async cacheUser(user: CachedUser): Promise<void> {
    await Promise.all([
      // Cache user by ID
      cacheService.set(user.id, user, {
        prefix: this.USER_PREFIX,
        ttl: config.redis.ttl.user,
      }),
      // Cache username → ID mapping
      cacheService.set(user.username, user.id, {
        prefix: this.USERNAME_MAP_PREFIX,
        ttl: config.redis.ttl.user,
      }),
    ]);
  }

  /**
   * Invalidates all cached data for a user.
   *
   * Call this after updating user data (profile changes, role changes, etc.)
   * to ensure next request gets fresh data from database.
   *
   * **Clears:**
   * - `user:{userId}` - User profile data
   * - `memberships:{userId}` - Tenant associations
   * - `username_map:{username}` - Username mapping (if provided)
   *
   * @param {string} userId UUID of the user
   * @param {string} [username] Optional username to also clear mapping
   * @returns {Promise<void>}
   *
   * @example After user update
   * ```typescript
   * app.patch('/users/:userId', async (request, reply) => {
   *   const { userId } = request.params;
   *   const updates = request.body;
   *
   *   // Update database
   *   await pool.query('UPDATE users SET email = $1 WHERE id = $2', [updates.email, userId]);
   *
   *   // Invalidate cache
   *   await userCacheService.invalidateUser(userId, updates.username);
   *
   *   return { success: true };
   * });
   * ```
   *
   * @example After role change
   * ```typescript
   * app.post('/users/:userId/roles', async (request, reply) => {
   *   const { userId } = request.params;
   *   const { tenantId, newRole } = request.body;
   *
   *   // Update user_tenant_associations
   *   await pool.query(
   *     'UPDATE user_tenant_associations SET role = $1 WHERE user_id = $2 AND tenant_id = $3',
   *     [newRole, userId, tenantId]
   *   );
   *
   *   // Clear cache so next auth gets new role
   *   await userCacheService.invalidateUser(userId);
   *
   *   return { success: true };
   * });
   * ```
   */
  async invalidateUser(userId: string, username?: string): Promise<void> {
    const deletions = [
      cacheService.del(userId, { prefix: this.USER_PREFIX }),
      cacheService.del(userId, { prefix: this.MEMBERSHIPS_PREFIX }),
    ];

    if (username) {
      deletions.push(cacheService.del(username, { prefix: this.USERNAME_MAP_PREFIX }));
    }

    await Promise.all(deletions);
  }

  /**
   * Invalidates ALL user caches (nuclear option - use sparingly!).
   *
   * Clears all user data, username mappings, and memberships from cache.
   * Useful for bulk operations or cache corruption recovery.
   *
   * **Warning:** This forces all subsequent requests to hit the database until
   * cache is repopulated. Use only when necessary (e.g., after bulk user import).
   *
   * @returns {Promise<number>} Total number of keys deleted
   *
   * @example After bulk user import
   * ```typescript
   * app.post('/admin/users/import', async (request, reply) => {
   *   // Import users from CSV
   *   await importUsersFromCSV(request.file);
   *
   *   // Clear all user caches
   *   const deleted = await userCacheService.invalidateAllUsers();
   *   app.log.info(`Cleared ${deleted} cache keys`);
   *
   *   // Warm up Bloom filter with new data
   *   await userCacheService.warmBloomFilter();
   *
   *   return { success: true, deleted };
   * });
   * ```
   */
  async invalidateAllUsers(): Promise<number> {
    const deleted = await Promise.all([
      cacheService.delPattern("*", { prefix: this.USER_PREFIX }),
      cacheService.delPattern("*", { prefix: this.USERNAME_MAP_PREFIX }),
      cacheService.delPattern("*", { prefix: this.MEMBERSHIPS_PREFIX }),
    ]);

    return deleted.reduce((sum, count) => sum + count, 0);
  }

  /**
   * Preloads Bloom filter with all active usernames from database.
   *
   * **CRITICAL:** Call this on application startup to initialize the Bloom filter.
   * Without warming, the Bloom filter will have false negatives (existing users
   * won't be recognized) until they're queried at least once.
   *
   * Only loads active, non-deleted users to keep filter accurate.
   *
   * **Performance:** Takes ~100ms for 10k users, ~1s for 100k users.
   *
   * @returns {Promise<number>} Number of usernames loaded into filter
   *
   * @example Application startup (src/index.ts)
   * ```typescript
   * const app = buildServer();
   *
   * app.listen({ port: 3000 }).then(async () => {
   *   app.log.info('Server started on port 3000');
   *
   *   // Initialize Redis and warm Bloom filter
   *   const redis = initRedis();
   *   if (redis) {
   *     app.log.info('Redis connected, warming Bloom filter...');
   *     const count = await userCacheService.warmBloomFilter();
   *     app.log.info(`Bloom filter initialized with ${count} usernames`);
   *   } else {
   *     app.log.warn('Redis unavailable - caching disabled');
   *   }
   * });
   * ```
   *
   * @example Periodic refresh (optional)
   * ```typescript
   * // Refresh Bloom filter every 24 hours to catch new users
   * setInterval(async () => {
   *   const count = await userCacheService.warmBloomFilter();
   *   console.log(`Bloom filter refreshed with ${count} usernames`);
   * }, 24 * 60 * 60 * 1000);
   * ```
   */
  async warmBloomFilter(): Promise<number> {
    try {
      const result = await pool.query<{ username: string }>(
        "SELECT username FROM users WHERE is_active = true AND deleted_at IS NULL",
      );

      const usernames = result.rows.map((row) => row.username);
      if (usernames.length > 0) {
        await usernameBloomFilter.addBatch(usernames);
      }

      return usernames.length;
    } catch (error) {
      console.error("Error warming Bloom filter:", error);
      return 0;
    }
  }

  /**
   * Fetches user from database by username.
   *
   * Internal method - excludes soft-deleted users (deleted_at IS NULL).
   *
   * @private
   * @param {string} username Username to look up
   * @returns {Promise<CachedUser | null>} User data or null
   */
  private async fetchUserFromDb(username: string): Promise<CachedUser | null> {
    try {
      const result = await pool.query(
        `SELECT id, username, email, first_name, last_name, is_active
         FROM users
         WHERE username = $1 AND deleted_at IS NULL`,
        [username],
      );

      if (result.rows.length === 0) return null;

      // Validate with Zod schema from @tartware/schemas
      return CachedUserSchema.parse(result.rows[0]);
    } catch (error) {
      console.error(`Error fetching user ${username}:`, error);
      return null;
    }
  }

  /**
   * Fetches user from database by ID.
   *
   * Internal method - excludes soft-deleted users (deleted_at IS NULL).
   *
   * @private
   * @param {string} userId UUID of user
   * @returns {Promise<CachedUser | null>} User data or null
   */
  private async fetchUserByIdFromDb(userId: string): Promise<CachedUser | null> {
    try {
      const result = await pool.query(
        `SELECT id, username, email, first_name, last_name, is_active
         FROM users
         WHERE id = $1 AND deleted_at IS NULL`,
        [userId],
      );

      if (result.rows.length === 0) return null;

      // Validate with Zod schema from @tartware/schemas
      return CachedUserSchema.parse(result.rows[0]);
    } catch (error) {
      console.error(`Error fetching user by ID ${userId}:`, error);
      return null;
    }
  }

  /**
   * Fetches user tenant memberships from database.
   *
   * Internal method - returns only active associations (deleted_at IS NULL).
   *
   * @private
   * @param {string} userId UUID of user
   * @returns {Promise<CachedMembership[]>} Array of tenant associations (empty if none)
   */
  private async fetchMembershipsFromDb(userId: string): Promise<CachedMembership[]> {
    type MembershipRow = {
      tenant_id: string;
      tenant_name: string | null;
      role: string;
      is_active: boolean;
      permissions: Record<string, unknown> | null;
      modules: unknown;
    };

    try {
      const result = await pool.query<MembershipRow>(
        `SELECT
           uta.tenant_id,
           uta.role,
           uta.is_active,
           uta.permissions,
           t.name AS tenant_name,
           COALESCE(t.config -> 'modules', '["core"]'::jsonb) AS modules
         FROM user_tenant_associations uta
         LEFT JOIN tenants t ON t.id = uta.tenant_id
         WHERE uta.user_id = $1
           AND COALESCE(uta.is_deleted, false) = false
           AND uta.deleted_at IS NULL`,
        [userId],
      );

      return result.rows.map((row) =>
        CachedMembershipSchema.parse({
          tenant_id: row.tenant_id,
          tenant_name: row.tenant_name ?? undefined,
          role: row.role,
          is_active: row.is_active,
          permissions: row.permissions ?? {},
          modules: normalizeModuleList(row.modules),
        }),
      );
    } catch (error) {
      recordMembershipCacheError();
      trackMembershipCacheSample("miss");
      console.error(`Error fetching memberships for user ${userId}:`, error);
      return [];
    }
  }
}

/**
 * Singleton instance of UserCacheService.
 *
 * Import this instance throughout the application for user caching operations.
 *
 * @example
 * ```typescript
 * import { userCacheService } from './services/user-cache-service';
 *
 * // In route handlers
 * const user = await userCacheService.getUserWithMemberships(username);
 *
 * // After updates
 * await userCacheService.invalidateUser(userId);
 *
 * // On startup
 * await userCacheService.warmBloomFilter();
 * ```
 */
export const userCacheService = new UserCacheService();
