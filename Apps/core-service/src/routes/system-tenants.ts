import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { TenantWithRelationsSchema } from "@tartware/schemas";
import { TenantTypeEnum } from "@tartware/schemas/enums";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { query } from "../lib/db.js";
import { logSystemAdminEvent } from "../services/system-admin-service.js";
import { listTenants } from "../services/tenant-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const SystemTenantListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const SystemTenantListResponseSchema = z.object({
  tenants: z.array(
    TenantWithRelationsSchema.extend({
      version: z.string(),
    }),
  ),
  count: z.number().int().nonnegative(),
});
const SystemTenantListQueryJsonSchema = schemaFromZod(
  SystemTenantListQuerySchema,
  "SystemTenantListQuery",
);
const SystemTenantListResponseJsonSchema = schemaFromZod(
  SystemTenantListResponseSchema,
  "SystemTenantListResponse",
);

const SYSTEM_TENANTS_TAG = "System Tenants";

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  type: TenantTypeEnum.default("INDEPENDENT"),
  email: z.string().email(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
});

const CreateTenantResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  message: z.string(),
});

const CreateTenantJsonSchema = schemaFromZod(CreateTenantSchema, "CreateTenant");
const CreateTenantResponseJsonSchema = schemaFromZod(
  CreateTenantResponseSchema,
  "CreateTenantResponse",
);

export const registerSystemTenantRoutes = (app: FastifyInstance): void => {
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

      const data = CreateTenantSchema.parse(request.body);

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
      return CreateTenantResponseSchema.parse({
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

      const { limit } = SystemTenantListQuerySchema.parse(request.query ?? {});
      const tenants = await listTenants({ limit });
      const sanitized = sanitizeForJson({
        tenants,
        count: tenants.length,
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
