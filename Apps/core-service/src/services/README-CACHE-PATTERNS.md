# Cache Service Reuse Patterns

The generic `cacheService` from `src/lib/cache.ts` is **completely reusable** for ANY entity. It uses Zod schemas from `@tartware/schemas` for validation.

## Core Principle

The `cacheService` is a **generic, type-safe wrapper** around Redis that provides:
- ✅ Automatic JSON serialization/deserialization
- ✅ TTL (Time To Live) management
- ✅ Type safety with TypeScript generics
- ✅ **Zod schema validation from @tartware/schemas**
- ✅ Batch operations (mget/mset)
- ✅ Pattern-based deletion
- ✅ Graceful degradation (works without Redis)

**You never need to write Redis commands directly!**

## Real-World Examples

See these working implementations in `src/services/`:
- **user-cache-service.ts** - Uses `UserSchema` from @tartware/schemas
- **tenant-cache-service.ts** - Uses `TenantSchema` from @tartware/schemas (example)
- **property-cache-service.ts** - Uses `PropertySchema` from @tartware/schemas (example)

## Pattern 1: Simple Entity Caching with Zod Schema

Use for: Users, Tenants, Properties, Rooms, Bookings, etc.

```typescript
import { z } from 'zod';
import { ReservationSchema } from '@tartware/schemas'; // Import from schema package
import { cacheService } from '../lib/cache';
import { pool } from '../lib/db';

// Define what fields you need for caching using .pick()
export const CachedReservationSchema = ReservationSchema.pick({
  id: true,
  guest_id: true,
  property_id: true,
  check_in: true,
  check_out: true,
  status: true,
  total_amount: true,
});

export type CachedReservation = z.infer<typeof CachedReservationSchema>;

export class ReservationCacheService {
  private readonly PREFIX = "reservation";
  private readonly TTL = 3600; // 1 hour

  async getReservation(id: string): Promise<CachedReservation | null> {
    // 1. Check cache first
    const cached = await cacheService.get<CachedReservation>(id, {
      prefix: this.PREFIX
    });
    if (cached) return cached;

    // 2. Cache miss - query database
    const reservation = await this.fetchFromDb(id);

    // 3. Populate cache for next request
    if (reservation) {
      await cacheService.set(id, reservation, {
        prefix: this.PREFIX,
        ttl: this.TTL
      });
    }

    return reservation;
  }

  private async fetchFromDb(id: string): Promise<CachedReservation | null> {
    const result = await pool.query(
      'SELECT id, guest_id, property_id, check_in, check_out, status, total_amount FROM reservations WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;

    // Validate with Zod schema from @tartware/schemas
    return CachedReservationSchema.parse(result.rows[0]);
  }
}
```

## Pattern 2: Mapping Cache (slug→ID, username→ID, code→ID) with Zod

Use for: Username lookups, slug lookups, code lookups, etc.

```typescript
import { z } from 'zod';
import { TenantSchema } from '@tartware/schemas';

// Define cached schema using .pick() from @tartware/schemas
export const CachedTenantSchema = TenantSchema.pick({
  id: true,
  name: true,
  slug: true,
  status: true,
});

export type CachedTenant = z.infer<typeof CachedTenantSchema>;

export class TenantMappingCache {
  private readonly ENTITY_PREFIX = "tenant";
  private readonly MAPPING_PREFIX = "tenant_slug";
  private readonly TTL = 3600;

  async getBySlug(slug: string): Promise<CachedTenant | null> {
    // 1. Check slug→ID mapping cache
    const tenantId = await cacheService.get<string>(slug, {
      prefix: this.MAPPING_PREFIX
    });

    if (tenantId) {
      // 2. Get tenant from cache using ID
      return this.getById(tenantId);
    }

    // 3. Cache miss - query database
    const tenant = await this.fetchBySlugFromDb(slug);

    // 4. Populate both caches
    if (tenant) {
      await Promise.all([
        cacheService.set(tenant.id, tenant, {
          prefix: this.ENTITY_PREFIX,
          ttl: this.TTL
        }),
        cacheService.set(slug, tenant.id, {
          prefix: this.MAPPING_PREFIX,
          ttl: this.TTL
        })
      ]);
    }

    return tenant;
  }

  private async fetchBySlugFromDb(slug: string): Promise<CachedTenant | null> {
    const result = await pool.query(
      'SELECT id, name, slug, status FROM tenants WHERE slug = $1',
      [slug]
    );
    if (result.rows.length === 0) return null;

    // Validate with Zod schema
    return CachedTenantSchema.parse(result.rows[0]);
  }
}
```

## Pattern 3: Batch Operations

Use for: Loading multiple entities at once (e.g., all properties for a tenant)

```typescript
export class BatchCacheService {
  async getMultiple(ids: string[]): Promise<Map<string, Entity>> {
    // 1. Try to get all from cache
    const cached = await cacheService.mget<Entity>(ids, {
      prefix: "entity"
    });

    // 2. Find cache misses
    const missingIds = ids.filter(id => !cached.has(id));

    // 3. Fetch missing ones from database
    if (missingIds.length > 0) {
      const dbResults = await this.fetchMultipleFromDb(missingIds);

      // 4. Cache them for next time
      if (dbResults.size > 0) {
        await cacheService.mset(dbResults, {
          prefix: "entity",
          ttl: 3600
        });

        // 5. Merge with cached results
        dbResults.forEach((entity, id) => cached.set(id, entity));
      }
    }

    return cached;
  }
}
```

## Pattern 4: List/Collection Caching

Use for: List of property IDs for a tenant, list of rooms for a property, etc.

```typescript
export class CollectionCacheService {
  async getItemsForParent(parentId: string): Promise<string[]> {
    // 1. Check if list is cached
    const cached = await cacheService.get<string[]>(parentId, {
      prefix: "parent_items"
    });
    if (cached) return cached;

    // 2. Cache miss - query database
    const itemIds = await this.fetchItemIdsFromDb(parentId);

    // 3. Cache the list
    if (itemIds.length > 0) {
      await cacheService.set(parentId, itemIds, {
        prefix: "parent_items",
        ttl: 3600
      });
    }

    return itemIds;
  }

  async invalidateList(parentId: string): Promise<void> {
    await cacheService.del(parentId, { prefix: "parent_items" });
  }
}
```

## Pattern 5: Counter/Stats Caching

Use for: Login attempts, rate limiting, API call counts, etc.

```typescript
export class CounterCacheService {
  async incrementCounter(key: string): Promise<number> {
    return cacheService.incr(key, { prefix: "counter" });
  }

  async getCounter(key: string): Promise<number> {
    const value = await cacheService.get<number>(key, { prefix: "counter" });
    return value ?? 0;
  }

  async resetCounter(key: string): Promise<void> {
    await cacheService.del(key, { prefix: "counter" });
  }
}
```

## Pattern 6: Session/Token Caching

Use for: JWT tokens, session data, temporary codes, etc.

```typescript
export class SessionCacheService {
  async storeSession(token: string, data: SessionData): Promise<void> {
    await cacheService.set(token, data, {
      prefix: "session",
      ttl: 1800 // 30 minutes
    });
  }

  async getSession(token: string): Promise<SessionData | null> {
    return cacheService.get<SessionData>(token, { prefix: "session" });
  }

  async extendSession(token: string, ttl: number): Promise<void> {
    await cacheService.expire(token, ttl, { prefix: "session" });
  }

  async destroySession(token: string): Promise<void> {
    await cacheService.del(token, { prefix: "session" });
  }
}
```

## Quick Reference: When to Use Each Pattern

| Use Case | Pattern | Example |
|----------|---------|---------|
| Single entity lookup | Pattern 1 | Get user by ID, Get property by ID |
| Lookup by alternate key | Pattern 2 | Get user by username, Get tenant by slug |
| Multiple entities at once | Pattern 3 | Get all properties for tenant |
| Parent→children relationship | Pattern 4 | Get all rooms for property |
| Counting/rate limiting | Pattern 5 | Login attempts, API rate limit |
| Temporary data | Pattern 6 | Sessions, reset tokens, OTP codes |

## Key Design Principles

1. **Always check cache first** before querying database
2. **Always populate cache on miss** for subsequent requests
3. **Use descriptive prefixes** (e.g., `user`, `tenant`, `property_code`)
4. **Set appropriate TTLs** based on data volatility
5. **Invalidate on updates** to prevent stale data
6. **Handle Redis unavailability** gracefully (cacheService does this automatically)

## Examples in This Codebase

- **user-cache-service.ts** - Pattern 1 + 2 (user by ID + username mapping)
- **tenant-cache-service.ts** - Pattern 1 + 2 (tenant by ID + slug mapping)
- **property-cache-service.ts** - Pattern 1 + 3 + 4 (property caching + batch + list)

## Testing Your Cache Service

```typescript
import { cacheService } from '../lib/cache';
import { yourCacheService } from './your-cache-service';

describe('Your Cache Service', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await cacheService.delPattern('*', { prefix: 'your_prefix' });
  });

  it('should cache and retrieve entity', async () => {
    const entity = await yourCacheService.getEntity('test-id');
    // First call hits DB, second call hits cache
    const cached = await yourCacheService.getEntity('test-id');
    expect(cached).toEqual(entity);
  });

  it('should invalidate cache', async () => {
    await yourCacheService.getEntity('test-id'); // Populate cache
    await yourCacheService.invalidate('test-id'); // Clear cache
    const exists = await cacheService.exists('test-id', { prefix: 'your_prefix' });
    expect(exists).toBe(false);
  });
});
```

## Performance Tips

1. **Batch operations are faster** - Use `mget`/`mset` when dealing with multiple items
2. **Set appropriate TTLs** - Don't cache data longer than needed
3. **Use specific prefixes** - Makes debugging and invalidation easier
4. **Monitor cache hit rate** - Log cache hits/misses in development
5. **Warm critical caches** - Preload frequently accessed data on startup

---

**Remember:** The `cacheService` is generic and works with ANY Zod schema from `@tartware/schemas`. Use `.pick()` to select the fields you need, and `.parse()` to validate data from the database! 🚀

## Quick Reference: When to Use Each Pattern
