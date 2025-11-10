/**
 * @fileoverview Tenant caching service using the generic cacheService.
 *
 * This demonstrates how to reuse the generic cacheService for tenant-specific caching.
 * The pattern shown here can be applied to ANY entity (properties, bookings, guests, etc.).
 *
 * @module services/tenant-cache-service
 * @category Services
 * @since 1.0.0
 *
 * @example Usage in route handlers
 * ```typescript
 * import { tenantCacheService } from './services/tenant-cache-service';
 *
 * app.get('/tenants/:id', async (request, reply) => {
 *   const { id } = request.params;
 *   const tenant = await tenantCacheService.getTenant(id);
 *   return reply.send(tenant);
 * });
 * ```
 */

import { z } from "zod";
import { TenantSchema } from "@tartware/schemas";
import { cacheService } from "../lib/cache.js";
import { config } from "../config.js";
import { pool } from "../lib/db.js";

/**
 * Cached tenant data structure - Uses Zod schema validation from @tartware/schemas.
 * Picks only the fields needed for caching.
 */
export const CachedTenantSchema = TenantSchema.pick({
  id: true,
  name: true,
  slug: true,
  type: true,
  status: true,
  email: true,
  phone: true,
  config: true,
  subscription: true,
});

export type CachedTenant = z.infer<typeof CachedTenantSchema>;

/**
 * Tenant Cache Service - Demonstrates generic cache reuse pattern.
 *
 * This service wraps the generic cacheService to provide tenant-specific
 * caching logic. The same pattern works for ANY entity.
 *
 * @class TenantCacheService
 *
 * @example
 * ```typescript
 * const tenantCacheService = new TenantCacheService();
 *
 * // Get tenant (cache-first)
 * const tenant = await tenantCacheService.getTenant('tenant-id-123');
 *
 * // Invalidate cache after updates
 * await tenantCacheService.invalidateTenant('tenant-id-123');
 * ```
 */
export class TenantCacheService {
  private readonly TENANT_PREFIX = "tenant";
  private readonly TENANT_SLUG_PREFIX = "tenant_slug";
  private readonly TTL = config.redis.ttl.tenant;

  /**
   * Get tenant by ID (cache-first, then database).
   *
   * @param {string} tenantId Tenant UUID
   * @returns {Promise<CachedTenant | null>} Tenant data or null
   *
   * @example
   * ```typescript
   * const tenant = await tenantCacheService.getTenant('123e4567-...');
   * if (tenant) {
   *   console.log(`Found: ${tenant.name}`);
   * }
   * ```
   */
  async getTenant(tenantId: string): Promise<CachedTenant | null> {
    // Check cache first
    const cached = await cacheService.get<CachedTenant>(tenantId, {
      prefix: this.TENANT_PREFIX,
    });

    if (cached) {
      return cached;
    }

    // Cache miss - query database
    const tenant = await this.fetchTenantFromDb(tenantId);

    if (tenant) {
      // Populate cache for next request
      await this.cacheTenant(tenant);
    }

    return tenant;
  }

  /**
   * Get tenant by slug (cache-first with slug→ID mapping).
   *
   * Similar pattern to username→userId mapping in user-cache-service.
   *
   * @param {string} slug Tenant slug
   * @returns {Promise<CachedTenant | null>} Tenant data or null
   *
   * @example
   * ```typescript
   * const tenant = await tenantCacheService.getTenantBySlug('acme-hotels');
   * ```
   */
  async getTenantBySlug(slug: string): Promise<CachedTenant | null> {
    // Check slug→ID mapping cache
    const tenantId = await cacheService.get<string>(slug, {
      prefix: this.TENANT_SLUG_PREFIX,
    });

    if (tenantId) {
      // Get tenant from cache using ID
      return this.getTenant(tenantId);
    }

    // Cache miss - query database
    const tenant = await this.fetchTenantBySlugFromDb(slug);

    if (tenant) {
      await this.cacheTenant(tenant);
    }

    return tenant;
  }

  /**
   * Get multiple tenants at once (batch operation).
   *
   * Demonstrates using cacheService.mget for efficient batch retrieval.
   *
   * @param {string[]} tenantIds Array of tenant UUIDs
   * @returns {Promise<Map<string, CachedTenant>>} Map of tenantId→tenant
   *
   * @example
   * ```typescript
   * const tenantIds = ['id1', 'id2', 'id3'];
   * const tenants = await tenantCacheService.getTenants(tenantIds);
   * tenants.forEach((tenant, id) => {
   *   console.log(`${id}: ${tenant.name}`);
   * });
   * ```
   */
  async getTenants(tenantIds: string[]): Promise<Map<string, CachedTenant>> {
    return cacheService.mget<CachedTenant>(tenantIds, {
      prefix: this.TENANT_PREFIX,
    });
  }

  /**
   * Invalidate tenant cache after updates.
   *
   * @param {string} tenantId Tenant UUID
   * @param {string} [slug] Optional slug to also invalidate slug mapping
   *
   * @example After tenant update
   * ```typescript
   * await pool.query('UPDATE tenants SET name = $1 WHERE id = $2', [newName, tenantId]);
   * await tenantCacheService.invalidateTenant(tenantId, tenant.slug);
   * ```
   */
  async invalidateTenant(tenantId: string, slug?: string): Promise<void> {
    const deletions = [
      cacheService.del(tenantId, { prefix: this.TENANT_PREFIX }),
    ];

    if (slug) {
      deletions.push(
        cacheService.del(slug, { prefix: this.TENANT_SLUG_PREFIX })
      );
    }

    await Promise.all(deletions);
  }

  /**
   * Cache tenant data with both ID and slug keys.
   *
   * @private
   */
  private async cacheTenant(tenant: CachedTenant): Promise<void> {
    await Promise.all([
      // Cache by ID
      cacheService.set(tenant.id, tenant, {
        prefix: this.TENANT_PREFIX,
        ttl: this.TTL,
      }),
      // Cache slug→ID mapping
      cacheService.set(tenant.slug, tenant.id, {
        prefix: this.TENANT_SLUG_PREFIX,
        ttl: this.TTL,
      }),
    ]);
  }

  /**
   * Fetch tenant from database by ID.
   *
   * @private
   */
  private async fetchTenantFromDb(tenantId: string): Promise<CachedTenant | null> {
    try {
      const result = await pool.query(
        `SELECT id, name, slug, type, status, email, phone, config, subscription
         FROM tenants
         WHERE id = $1 AND deleted_at IS NULL`,
        [tenantId]
      );

      if (result.rows.length === 0) return null;
      
      // Validate with Zod schema from @tartware/schemas
      return CachedTenantSchema.parse(result.rows[0]);
    } catch (error) {
      console.error(`Error fetching tenant ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Fetch tenant from database by slug.
   *
   * @private
   */
  private async fetchTenantBySlugFromDb(slug: string): Promise<CachedTenant | null> {
    try {
      const result = await pool.query(
        `SELECT id, name, slug, type, status, email, phone, config, subscription
         FROM tenants
         WHERE slug = $1 AND deleted_at IS NULL`,
        [slug]
      );

      if (result.rows.length === 0) return null;
      
      // Validate with Zod schema from @tartware/schemas
      return CachedTenantSchema.parse(result.rows[0]);
    } catch (error) {
      console.error(`Error fetching tenant by slug ${slug}:`, error);
      return null;
    }
  }
}

/**
 * Singleton instance for tenant caching.
 */
export const tenantCacheService = new TenantCacheService();
