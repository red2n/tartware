import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import type { PropertyListQuery } from "@tartware/schemas";
import {
  CreatePropertyBodySchema,
  CreatePropertyResponseSchema,
  PropertyListQuerySchema,
  PropertyListResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { query } from "../lib/db.js";
import { listProperties } from "../services/property-service.js";

const PropertyListQueryJsonSchema = schemaFromZod(PropertyListQuerySchema, "PropertyListQuery");
const PropertyListResponseJsonSchema = schemaFromZod(
  PropertyListResponseSchema,
  "PropertyListResponse",
);

const PROPERTIES_TAG = "Properties";

const CreatePropertyJsonSchema = schemaFromZod(CreatePropertyBodySchema, "CreateProperty");
const CreatePropertyResponseJsonSchema = schemaFromZod(
  CreatePropertyResponseSchema,
  "CreatePropertyResponse",
);

export const registerPropertyRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/properties",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
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
      const data = CreatePropertyBodySchema.parse(request.body);
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
