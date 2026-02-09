import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { PropertyWithStatsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { query } from "../lib/db.js";
import { listProperties } from "../services/property-service.js";

const PropertyListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  tenant_id: z.string().uuid(),
});

type PropertyListQuery = z.infer<typeof PropertyListQuerySchema>;

// Response schema with version as string (BigInt serialized for JSON)
const PropertyListResponseSchema = z.array(
  PropertyWithStatsSchema.omit({ version: true }).extend({
    version: z.string(),
  }),
);
const PropertyListQueryJsonSchema = schemaFromZod(PropertyListQuerySchema, "PropertyListQuery");
const PropertyListResponseJsonSchema = schemaFromZod(
  PropertyListResponseSchema,
  "PropertyListResponse",
);

const PROPERTIES_TAG = "Properties";

const CreatePropertySchema = z.object({
  tenant_id: z.string().uuid(),
  property_name: z.string().min(1).max(200),
  property_code: z.string().min(1).max(50),
  property_type: z.string().optional(),
  star_rating: z.number().min(0).max(5).optional(),
  total_rooms: z.number().int().nonnegative().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().optional(),
});

const CreatePropertyResponseSchema = z.object({
  id: z.string().uuid(),
  property_name: z.string(),
  property_code: z.string(),
  message: z.string(),
});

const CreatePropertyJsonSchema = schemaFromZod(CreatePropertySchema, "CreateProperty");
const CreatePropertyResponseJsonSchema = schemaFromZod(
  CreatePropertyResponseSchema,
  "CreatePropertyResponse",
);

export const registerPropertyRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/properties",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof CreatePropertySchema>).tenant_id,
        minRole: "ADMIN",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: PROPERTIES_TAG,
        summary: "Create a new property",
        body: CreatePropertyJsonSchema,
        response: {
          201: CreatePropertyResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const data = CreatePropertySchema.parse(request.body);
      const address = data.address || {};

      const { rows } = await query<{ id: string; property_name: string; property_code: string }>(
        `INSERT INTO properties
         (tenant_id, property_name, property_code, property_type, star_rating, total_rooms,
          phone, email, website, address, currency, timezone, config, integrations, is_active, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '{}', '{}', true, '{}')
         RETURNING id, property_name, property_code`,
        [
          data.tenant_id,
          data.property_name,
          data.property_code,
          data.property_type || null,
          data.star_rating || null,
          data.total_rooms || null,
          data.phone || null,
          data.email || null,
          data.website || null,
          JSON.stringify(address),
          data.currency || "USD",
          data.timezone || "UTC",
        ],
      );

      const property = rows[0];
      if (!property) {
        throw new Error("Failed to create property");
      }

      reply.status(201);
      return CreatePropertyResponseSchema.parse({
        id: property.id,
        property_name: property.property_name,
        property_code: property.property_code,
        message: "Property created successfully",
      });
    },
  );

  app.get<{ Querystring: PropertyListQuery }>(
    "/v1/properties",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as PropertyListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: PROPERTIES_TAG,
        summary: "List properties for a tenant",
        querystring: PropertyListQueryJsonSchema,
        response: {
          200: PropertyListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { limit, offset, tenant_id } = PropertyListQuerySchema.parse(request.query);
      const properties = await listProperties({ limit, offset, tenantId: tenant_id });
      // Properties already have version as string from the service
      return PropertyListResponseSchema.parse(properties);
    },
  );
};
