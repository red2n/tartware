import { randomUUID } from "node:crypto";

import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import type { TenantListQuery } from "@tartware/schemas";
import {
  TenantBootstrapResponseSchema,
  TenantBootstrapSchema,
  TenantListQuerySchema,
  TenantScopedListResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { pool } from "../lib/db.js";
import { listTenants } from "../services/tenant-service.js";
import { hashPassword } from "../utils/password.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const TenantListQueryJsonSchema = schemaFromZod(TenantListQuerySchema, "TenantListQuery");
const TenantListResponseJsonSchema = schemaFromZod(
  TenantScopedListResponseSchema,
  "TenantListResponse",
);

const TenantBootstrapJsonSchema = schemaFromZod(TenantBootstrapSchema, "TenantBootstrap");
const TenantBootstrapResponseJsonSchema = schemaFromZod(
  TenantBootstrapResponseSchema,
  "TenantBootstrapResponse",
);

const TENANTS_TAG = "Tenants";
const BOOTSTRAP_TOKEN_HEADER = "x-onboarding-token";
const bootstrapRateLimitMax = Number(process.env.TENANT_BOOTSTRAP_RATE_LIMIT_MAX ?? "10");
const bootstrapRateLimitWindowMs = Number(
  process.env.TENANT_BOOTSTRAP_RATE_LIMIT_WINDOW_MS ?? "60000",
);
const bootstrapRateLimits = new Map<string, { count: number; resetAt: number }>();
let bootstrapRateLimitLastCleanup = 0;
const bootstrapRateLimitCleanupIntervalMs = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of bootstrapRateLimits) {
    if (entry.resetAt <= now) {
      bootstrapRateLimits.delete(key);
    }
  }
  bootstrapRateLimitLastCleanup = now;
}, bootstrapRateLimitCleanupIntervalMs).unref?.();

const checkBootstrapRateLimit = (ip: string): { allowed: boolean; retryAfterMs?: number } => {
  if (!Number.isFinite(bootstrapRateLimitMax) || bootstrapRateLimitMax <= 0) {
    return { allowed: true };
  }

  const now = Date.now();
  if (now - bootstrapRateLimitLastCleanup >= bootstrapRateLimitCleanupIntervalMs) {
    for (const [key, entry] of bootstrapRateLimits) {
      if (entry.resetAt <= now) {
        bootstrapRateLimits.delete(key);
      }
    }
    bootstrapRateLimitLastCleanup = now;
  }
  const entry = bootstrapRateLimits.get(ip);
  if (!entry || entry.resetAt <= now) {
    bootstrapRateLimits.set(ip, { count: 1, resetAt: now + bootstrapRateLimitWindowMs });
    return { allowed: true };
  }

  if (entry.count >= bootstrapRateLimitMax) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true };
};

export const registerTenantRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: TenantListQuery }>(
    "/v1/tenants",
    {
      preHandler: app.withTenantScope({
        allowMissingTenantId: true,
        requireAnyTenantWithRole: "ADMIN",
      }),
      schema: buildRouteSchema({
        tag: TENANTS_TAG,
        summary: "List the tenants available to the authenticated user",
        querystring: TenantListQueryJsonSchema,
        response: {
          200: TenantListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { limit, offset } = TenantListQuerySchema.parse(request.query);
      // Only return tenants the user has access to
      const tenantIds = Array.from(request.auth.membershipMap.keys());
      const tenants = await listTenants({ limit, offset, tenantIds });
      const response = sanitizeForJson({ tenants, count: tenants.length, limit, offset });
      return TenantScopedListResponseSchema.parse(response);
    },
  );

  app.post(
    "/v1/tenants/bootstrap",
    {
      schema: buildRouteSchema({
        tag: TENANTS_TAG,
        summary: "Self-serve tenant onboarding (tenant + property + owner user)",
        body: TenantBootstrapJsonSchema,
        response: {
          201: TenantBootstrapResponseJsonSchema,
          400: errorResponseSchema,
          409: errorResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const requiredToken = process.env.TENANT_BOOTSTRAP_TOKEN;
      if (requiredToken) {
        const providedToken = request.headers[BOOTSTRAP_TOKEN_HEADER] ?? "";
        if (providedToken !== requiredToken) {
          return reply.unauthorized("Invalid onboarding token.");
        }
      }

      const rateLimit = checkBootstrapRateLimit(request.ip);
      if (!rateLimit.allowed) {
        if (rateLimit.retryAfterMs) {
          reply.header("Retry-After", Math.ceil(rateLimit.retryAfterMs / 1000).toString());
        }
        return reply.status(429).send({
          error: "Too Many Requests",
          message: "Onboarding rate limit exceeded.",
        });
      }

      const payload = TenantBootstrapSchema.parse(request.body);
      const tenantInput = payload.tenant;
      const propertyInput = payload.property;
      const ownerInput = payload.owner;

      const normalizedTenantSlug =
        tenantInput.slug?.toLowerCase() ??
        tenantInput.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const normalizedPropertyCode = propertyInput.property_code
        ? propertyInput.property_code.toUpperCase()
        : (() => {
            const derived = propertyInput.property_name
              .toUpperCase()
              .replace(/[^A-Z0-9]+/g, "")
              .slice(0, 12);
            return derived || "PROP";
          })();

      const propertyAddress = propertyInput.address ?? {};
      const passwordHash = await hashPassword(ownerInput.password);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const existingTenant = await client.query<{ id: string }>(
          `SELECT id
           FROM tenants
           WHERE slug = $1
             AND deleted_at IS NULL
             AND COALESCE(is_deleted, false) = false
           LIMIT 1`,
          [normalizedTenantSlug],
        );
        if (existingTenant.rows.length > 0) {
          throw request.server.httpErrors.conflict("TENANT_SLUG_EXISTS");
        }

        const existingUser = await client.query<{ id: string }>(
          `SELECT id
           FROM users
           WHERE (username = $1 OR email = $2)
             AND deleted_at IS NULL
             AND COALESCE(is_deleted, false) = false
           LIMIT 1`,
          [ownerInput.username, ownerInput.email],
        );
        if (existingUser.rows.length > 0) {
          throw request.server.httpErrors.conflict("USER_ALREADY_EXISTS");
        }

        const ownerId = randomUUID();
        const tenantId = randomUUID();
        const tenantResult = await client.query<{ id: string; name: string; slug: string }>(
          `INSERT INTO tenants
            (id, tenant_id, name, slug, type, status, email, phone, website, config, subscription, metadata, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $7, $8, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, $9, $9)
           RETURNING id, name, slug`,
          [
            tenantId,
            tenantId,
            tenantInput.name,
            normalizedTenantSlug,
            tenantInput.type,
            tenantInput.email,
            tenantInput.phone || null,
            tenantInput.website || null,
            ownerId,
          ],
        );

        const tenant = tenantResult.rows[0];
        if (!tenant) {
          throw new Error("Failed to create tenant");
        }

        const userResult = await client.query<{ id: string; username: string; email: string }>(
          `INSERT INTO users
            (id, tenant_id, username, email, password_hash, first_name, last_name, phone, mfa_secret, is_active, is_verified, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false, $10, $10)
           RETURNING id, username, email`,
          [
            ownerId,
            tenant.id,
            ownerInput.username,
            ownerInput.email,
            passwordHash,
            ownerInput.first_name,
            ownerInput.last_name,
            ownerInput.phone || null,
            "0000000000000000",
            ownerId,
          ],
        );

        const owner = userResult.rows[0];
        if (!owner) {
          throw new Error("Failed to create owner user");
        }

        await client.query(
          `INSERT INTO user_tenant_associations
            (user_id, tenant_id, role, is_active, created_by, updated_by)
           VALUES ($1, $2, 'OWNER', true, $3, $3)`,
          [owner.id, tenant.id, ownerId],
        );

        const propertyResult = await client.query<{
          id: string;
          property_name: string;
          property_code: string;
        }>(
          `INSERT INTO properties
            (tenant_id, property_name, property_code, property_type, star_rating, total_rooms,
             phone, email, website, address, currency, timezone, config, integrations, is_active, metadata, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '{}'::jsonb, '{}'::jsonb, true, '{}'::jsonb, $13, $13)
           RETURNING id, property_name, property_code`,
          [
            tenant.id,
            propertyInput.property_name,
            normalizedPropertyCode,
            propertyInput.property_type || null,
            propertyInput.star_rating || null,
            propertyInput.total_rooms || null,
            propertyInput.phone || null,
            propertyInput.email || null,
            propertyInput.website || null,
            JSON.stringify(propertyAddress),
            propertyInput.currency || "USD",
            propertyInput.timezone || "UTC",
            ownerId,
          ],
        );

        const property = propertyResult.rows[0];
        if (!property) {
          throw new Error("Failed to create property");
        }

        await client.query("COMMIT");

        reply.status(201);
        return TenantBootstrapResponseSchema.parse({
          tenant,
          property,
          owner,
          message: "Tenant bootstrapped successfully",
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  );
};
