/**
 * @fileoverview Property caching service using the generic cacheService.
 *
 * Another example demonstrating how to reuse the generic cacheService for
 * property-specific caching with tenant isolation.
 *
 * @module services/property-cache-service
 * @category Services
 * @since 1.0.0
 *
 * @example Usage in route handlers
 * ```typescript
 * import { propertyCacheService } from './services/property-cache-service';
 *
 * app.get('/properties/:id', async (request, reply) => {
 *   const { id } = request.params;
 *   const property = await propertyCacheService.getProperty(id);
 *   return reply.send(property);
 * });
 * ```
 */

import { z } from "zod";
import { PropertySchema } from "@tartware/schemas";
import { cacheService } from "../lib/cache.js";
import { config } from "../config.js";
import { pool } from "../lib/db.js";

/**
 * Cached property data structure - Uses Zod schema validation from @tartware/schemas.
 * Picks only the fields needed for caching.
 */
export const CachedPropertySchema = PropertySchema.pick({
  id: true,
  tenant_id: true,
  property_code: true,
  property_name: true,
  property_type: true,
  address: true,
  timezone: true,
  currency: true,
  total_rooms: true,
});

export type CachedProperty = z.infer<typeof CachedPropertySchema>;

/**
 * Property Cache Service - Demonstrates caching with tenant isolation.
 *
 * Shows how to implement tenant-scoped caching using key prefixes.
 * The generic cacheService handles all Redis operations.
 *
 * @class PropertyCacheService
 *
 * @example
 * ```typescript
 * const propertyCacheService = new PropertyCacheService();
 *
 * // Get property (cache-first)
 * const property = await propertyCacheService.getProperty('property-id');
 *
 * // Get all properties for a tenant
 * const properties = await propertyCacheService.getPropertiesByTenant('tenant-id');
 *
 * // Invalidate after updates
 * await propertyCacheService.invalidateProperty('property-id', 'tenant-id');
 * ```
 */
export class PropertyCacheService {
  private readonly PROPERTY_PREFIX = "property";
  private readonly TENANT_PROPERTIES_PREFIX = "tenant_properties";
  private readonly TTL = config.redis.ttl.default; // 1 hour

  /**
   * Get property by ID (cache-first).
   *
   * @param {string} propertyId Property UUID
   * @returns {Promise<CachedProperty | null>} Property data or null
   */
  async getProperty(propertyId: string): Promise<CachedProperty | null> {
    // Check cache first
    const cached = await cacheService.get<CachedProperty>(propertyId, {
      prefix: this.PROPERTY_PREFIX,
    });

    if (cached) {
      return cached;
    }

    // Cache miss - query database
    const property = await this.fetchPropertyFromDb(propertyId);

    if (property) {
      await this.cacheProperty(property);
    }

    return property;
  }

  /**
   * Get all property IDs for a tenant (cached list).
   *
   * Demonstrates caching collection/list data.
   *
   * @param {string} tenantId Tenant UUID
   * @returns {Promise<string[]>} Array of property IDs
   *
   * @example
   * ```typescript
   * const propertyIds = await propertyCacheService.getPropertiesByTenant(tenantId);
   * const properties = await Promise.all(
   *   propertyIds.map(id => propertyCacheService.getProperty(id))
   * );
   * ```
   */
  async getPropertiesByTenant(tenantId: string): Promise<string[]> {
    // Check if tenant's property list is cached
    const cached = await cacheService.get<string[]>(tenantId, {
      prefix: this.TENANT_PROPERTIES_PREFIX,
    });

    if (cached) {
      return cached;
    }

    // Cache miss - query database
    const propertyIds = await this.fetchPropertyIdsByTenant(tenantId);

    if (propertyIds.length > 0) {
      // Cache the list
      await cacheService.set(tenantId, propertyIds, {
        prefix: this.TENANT_PROPERTIES_PREFIX,
        ttl: this.TTL,
      });
    }

    return propertyIds;
  }

  /**
   * Get multiple properties at once (batch operation).
   *
   * @param {string[]} propertyIds Array of property UUIDs
   * @returns {Promise<Map<string, CachedProperty>>} Map of propertyId→property
   */
  async getProperties(propertyIds: string[]): Promise<Map<string, CachedProperty>> {
    // Use generic cacheService batch get
    const cached = await cacheService.mget<CachedProperty>(propertyIds, {
      prefix: this.PROPERTY_PREFIX,
    });

    // Find cache misses
    const missingIds = propertyIds.filter((id) => !cached.has(id));

    if (missingIds.length > 0) {
      // Fetch missing properties from database
      const dbProperties = await this.fetchPropertiesFromDb(missingIds);

      // Cache them for next time
      if (dbProperties.size > 0) {
        await cacheService.mset(dbProperties, {
          prefix: this.PROPERTY_PREFIX,
          ttl: this.TTL,
        });

        // Merge with cached results
        dbProperties.forEach((prop, id) => cached.set(id, prop));
      }
    }

    return cached;
  }

  /**
   * Invalidate property cache after updates.
   *
   * Also invalidates the tenant's property list cache.
   *
   * @param {string} propertyId Property UUID
   * @param {string} tenantId Tenant UUID
   */
  async invalidateProperty(propertyId: string, tenantId: string): Promise<void> {
    await Promise.all([
      // Invalidate property cache
      cacheService.del(propertyId, { prefix: this.PROPERTY_PREFIX }),
      // Invalidate tenant's property list
      cacheService.del(tenantId, { prefix: this.TENANT_PROPERTIES_PREFIX }),
    ]);
  }

  /**
   * Invalidate all properties for a tenant.
   *
   * Useful after bulk operations.
   *
   * @param {string} tenantId Tenant UUID
   */
  async invalidateTenantProperties(tenantId: string): Promise<number> {
    // Get property IDs first
    const propertyIds = await this.getPropertiesByTenant(tenantId);

    // Delete all property caches
    const deletions = propertyIds.map((id) =>
      cacheService.del(id, { prefix: this.PROPERTY_PREFIX })
    );

    // Also delete the tenant's property list
    deletions.push(
      cacheService.del(tenantId, { prefix: this.TENANT_PROPERTIES_PREFIX })
    );

    await Promise.all(deletions);
    return propertyIds.length;
  }

  /**
   * Cache property data.
   *
   * @private
   */
  private async cacheProperty(property: CachedProperty): Promise<void> {
    await cacheService.set(property.id, property, {
      prefix: this.PROPERTY_PREFIX,
      ttl: this.TTL,
    });
  }

  /**
   * Fetch property from database by ID.
   *
   * @private
   */
  private async fetchPropertyFromDb(propertyId: string): Promise<CachedProperty | null> {
    try {
      const result = await pool.query(
        `SELECT id, tenant_id, property_code, property_name, property_type,
                address, timezone, currency, total_rooms
         FROM properties
         WHERE id = $1 AND deleted_at IS NULL`,
        [propertyId]
      );

      if (result.rows.length === 0) return null;

      // Validate with Zod schema from @tartware/schemas
      return CachedPropertySchema.parse(result.rows[0]);
    } catch (error) {
      console.error(`Error fetching property ${propertyId}:`, error);
      return null;
    }
  }

  /**
   * Fetch property IDs for a tenant.
   *
   * @private
   */
  private async fetchPropertyIdsByTenant(tenantId: string): Promise<string[]> {
    try {
      const result = await pool.query<{ id: string }>(
        `SELECT id FROM properties
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY property_name`,
        [tenantId]
      );

      return result.rows.map((row) => row.id);
    } catch (error) {
      console.error(`Error fetching properties for tenant ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * Fetch multiple properties from database.
   *
   * @private
   */
  private async fetchPropertiesFromDb(propertyIds: string[]): Promise<Map<string, CachedProperty>> {
    try {
      const result = await pool.query(
        `SELECT id, tenant_id, property_code, property_name, property_type,
                address, timezone, currency, total_rooms
         FROM properties
         WHERE id = ANY($1) AND deleted_at IS NULL`,
        [propertyIds]
      );

      const map = new Map<string, CachedProperty>();
      // Validate each row with Zod schema from @tartware/schemas
      result.rows.forEach((prop) => {
        const validated = CachedPropertySchema.parse(prop);
        map.set(validated.id, validated);
      });
      return map;
    } catch (error) {
      console.error("Error fetching properties:", error);
      return new Map();
    }
  }
}

/**
 * Singleton instance for property caching.
 */
export const propertyCacheService = new PropertyCacheService();
