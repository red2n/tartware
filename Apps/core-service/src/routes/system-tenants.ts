import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import {
  SystemBootstrapTenantSchema,
  SystemCreateTenantResponseSchema,
  SystemCreateTenantSchema,
  SystemTenantListQuerySchema,
  SystemTenantListResponseSchema,
  TenantBootstrapResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { pool, query } from "../lib/db.js";
import { logSystemAdminEvent } from "../services/system-admin-service.js";
import { listTenants } from "../services/tenant-service.js";
import { hashPassword } from "../utils/password.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const SystemTenantListQueryJsonSchema = schemaFromZod(
  SystemTenantListQuerySchema,
  "SystemTenantListQuery",
);
const SystemTenantListResponseJsonSchema = schemaFromZod(
  SystemTenantListResponseSchema,
  "SystemTenantListResponse",
);

const SYSTEM_TENANTS_TAG = "System Tenants";

const CreateTenantJsonSchema = schemaFromZod(SystemCreateTenantSchema, "CreateTenant");
const CreateTenantResponseJsonSchema = schemaFromZod(
  SystemCreateTenantResponseSchema,
  "CreateTenantResponse",
);

const BootstrapTenantJsonSchema = schemaFromZod(SystemBootstrapTenantSchema, "BootstrapTenant");
const BootstrapTenantResponseJsonSchema = schemaFromZod(
  TenantBootstrapResponseSchema,
  "BootstrapTenantResponse",
);

export const registerSystemTenantRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/system/tenants/bootstrap",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_ADMIN" }),
      schema: buildRouteSchema({
        tag: SYSTEM_TENANTS_TAG,
        summary: "Bootstrap a tenant with a primary property and owner user",
        body: BootstrapTenantJsonSchema,
        response: {
          201: BootstrapTenantResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw request.server.httpErrors.unauthorized("System admin authentication required");
      }

      const payload = SystemBootstrapTenantSchema.parse(request.body);
      const tenantInput = payload.tenant;
      const propertyInput = payload.property;
      const ownerInput = payload.owner;

      const tenantSlug = tenantInput.slug.toLowerCase();
      const propertyCode = propertyInput.property_code.toUpperCase();
      const propertyAddress = propertyInput.address ?? {};
      const passwordHash = await hashPassword(ownerInput.password);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const tenantResult = await client.query<{ id: string; name: string; slug: string }>(
          `INSERT INTO tenants
            (name, slug, type, status, email, phone, website, config, subscription, metadata, created_by, updated_by)
           VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, $7, $7)
           RETURNING id, name, slug`,
          [
            tenantInput.name,
            tenantSlug,
            tenantInput.type,
            tenantInput.email,
            tenantInput.phone || null,
            tenantInput.website || null,
            adminContext.adminId,
          ],
        );

        const tenant = tenantResult.rows[0];
        if (!tenant) {
          throw new Error("Failed to create tenant");
        }

        const userResult = await client.query<{ id: string; username: string; email: string }>(
          `INSERT INTO users
            (username, email, password_hash, first_name, last_name, phone, is_active, is_verified, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, true, false, $7, $7)
           RETURNING id, username, email`,
          [
            ownerInput.username,
            ownerInput.email,
            passwordHash,
            ownerInput.first_name,
            ownerInput.last_name,
            ownerInput.phone || null,
            adminContext.adminId,
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
          [owner.id, tenant.id, adminContext.adminId],
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
            propertyCode,
            propertyInput.property_type || null,
            propertyInput.star_rating || null,
            propertyInput.total_rooms || null,
            propertyInput.phone || null,
            propertyInput.email || null,
            propertyInput.website || null,
            JSON.stringify(propertyAddress),
            propertyInput.currency || "USD",
            propertyInput.timezone || "UTC",
            adminContext.adminId,
          ],
        );

        const property = propertyResult.rows[0];
        if (!property) {
          throw new Error("Failed to create property");
        }

        await client.query("COMMIT");

        await logSystemAdminEvent({
          adminId: adminContext.adminId,
          action: "TENANT_BOOTSTRAP",
          resourceType: "TENANT",
          resourceId: tenant.id,
          tenantId: tenant.id,
          requestMethod: "POST",
          requestPath: request.url,
          responseStatus: 201,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
          sessionId: adminContext.sessionId,
        });

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

  app.post(
    "/v1/system/tenants",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_ADMIN" }),
      schema: buildRouteSchema({
        tag: SYSTEM_TENANTS_TAG,
        summary: "Create a new tenant",
        body: CreateTenantJsonSchema,
        response: {
          201: CreateTenantResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw request.server.httpErrors.unauthorized("System admin authentication required");
      }

      const data = SystemCreateTenantSchema.parse(request.body);

      const { rows } = await query<{ id: string; name: string; slug: string }>(
        `INSERT INTO tenants (name, slug, type, status, email, phone, website, config, subscription, metadata)
         VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, '{}', '{}', '{}')
         RETURNING id, name, slug`,
        [data.name, data.slug, data.type, data.email, data.phone || null, data.website || null],
      );

      const tenant = rows[0];
      if (!tenant) {
        throw new Error("Failed to create tenant");
      }

      await logSystemAdminEvent({
        adminId: adminContext.adminId,
        action: "TENANT_CREATE",
        resourceType: "TENANT",
        resourceId: tenant.id,
        requestMethod: "POST",
        requestPath: request.url,
        responseStatus: 201,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        sessionId: adminContext.sessionId,
      });

      reply.status(201);
      return SystemCreateTenantResponseSchema.parse({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        message: "Tenant created successfully",
      });
    },
  );

  app.get(
    "/v1/system/tenants",
    {
      preHandler: app.withSystemAdminScope({ minRole: "SYSTEM_OPERATOR" }),
      schema: buildRouteSchema({
        tag: SYSTEM_TENANTS_TAG,
        summary: "List tenants for system administrators",
        querystring: SystemTenantListQueryJsonSchema,
        response: {
          200: SystemTenantListResponseJsonSchema,
          401: errorResponseSchema,
        },
      }),
    },
    async (request) => {
      const adminContext = request.systemAdmin;
      if (!adminContext) {
        throw request.server.httpErrors.unauthorized(
          "System admin authentication middleware failed to populate context. Ensure the system admin plugin is registered and the request carries a valid token.",
        );
      }

      const { limit, offset } = SystemTenantListQuerySchema.parse(request.query ?? {});
      const tenants = await listTenants({ limit, offset });
      const sanitized = sanitizeForJson({
        tenants,
        count: tenants.length,
        limit,
        offset,
      });

      await logSystemAdminEvent({
        adminId: adminContext.adminId,
        action: "SYSTEM_TENANTS_LIST",
        resourceType: "TENANT",
        requestMethod: "GET",
        requestPath: request.url,
        responseStatus: 200,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        sessionId: adminContext.sessionId,
      });

      return SystemTenantListResponseSchema.parse(sanitized);
    },
  );
};
