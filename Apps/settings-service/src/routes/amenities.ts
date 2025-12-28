import { buildRouteSchema, type JsonSchema, schemaFromZod } from "@tartware/openapi";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";

import {
  type AmenityRecord,
  createAmenity,
  listAmenities,
  updateAmenity,
} from "../repositories/amenity-catalog-repository.js";
import type { AuthUser } from "../types/auth.js";

const AMENITIES_TAG = "Amenity Catalog";

const AmenitySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  propertyId: z.string().uuid(),
  amenityCode: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  category: z.string(),
  icon: z.string().optional(),
  tags: z.array(z.string()).default([]),
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  isRequired: z.boolean(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  createdBy: z.string().uuid().optional(),
  updatedBy: z.string().uuid().optional(),
});

const AmenitiesListResponseSchema = z.object({
  data: z.array(AmenitySchema),
  meta: z.object({
    count: z.number().int(),
  }),
});

const AmenityResponseSchema = z.object({
  data: AmenitySchema,
});

const PropertyParamsSchema = z.object({
  propertyId: z.string().uuid(),
});

const AmenityParamsSchema = PropertyParamsSchema.extend({
  amenityCode: z.string().regex(/^[A-Za-z0-9_-]+$/),
});

const CreateAmenityBodySchema = z.object({
  amenityCode: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, {
      message: "Amenity code must be alphanumeric (with _ or -)",
    }),
  displayName: z.string().min(2).max(160),
  description: z.string().max(1024).optional(),
  category: z.string().max(80).optional(),
  icon: z.string().max(120).optional(),
  tags: z.array(z.string().max(80)).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateAmenityBodySchema = CreateAmenityBodySchema.partial().omit({
  amenityCode: true,
  isDefault: true,
});

const listAmenitiesResponse: JsonSchema = schemaFromZod(
  AmenitiesListResponseSchema,
  "AmenityListResponse",
);

const amenityResponse: JsonSchema = schemaFromZod(AmenityResponseSchema, "AmenityResponse");

const createAmenityBody: JsonSchema = schemaFromZod(CreateAmenityBodySchema, "CreateAmenityBody");

const updateAmenityBody: JsonSchema = schemaFromZod(UpdateAmenityBodySchema, "UpdateAmenityBody");

const ParamsSchema: JsonSchema = schemaFromZod(PropertyParamsSchema, "PropertyParams");
const AmenityParamsJson: JsonSchema = schemaFromZod(AmenityParamsSchema, "AmenityParams");

const hasScope = (user: AuthUser | undefined, requiredScope: string) => {
  if (!user) {
    return false;
  }
  if (!user.scope) {
    return false;
  }
  const normalizedScopes = Array.isArray(user.scope) ? user.scope : user.scope.split(" ");
  return normalizedScopes.includes(requiredScope);
};

const enforceScope = (
  request: FastifyRequest,
  reply: FastifyReply,
  scope: string,
): request is FastifyRequest & { authUser: AuthUser } => {
  if (!request.authUser) {
    void reply.status(401).send({ message: "Unauthorized" });
    return false;
  }
  if (!hasScope(request.authUser, scope)) {
    void reply.status(403).send({ message: `Missing scope ${scope}` });
    return false;
  }
  return true;
};

const toIsoString = (value?: Date | string | null) => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
};

const serializeAmenity = (record: AmenityRecord) => ({
  ...record,
  metadata: record.metadata ?? {},
  createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
  updatedAt: toIsoString(record.updatedAt),
});

const amenitiesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/v1/settings/properties/:propertyId/amenities",
    {
      schema: buildRouteSchema({
        tag: AMENITIES_TAG,
        summary: "List amenities for a property",
        params: ParamsSchema,
        response: {
          200: listAmenitiesResponse,
        },
      }),
    },
    async (request, reply) => {
      if (!enforceScope(request, reply, "settings:read")) {
        return;
      }

      const { propertyId } = PropertyParamsSchema.parse(request.params);
      const amenities = await listAmenities({
        tenantId: request.authUser.tenantId,
        propertyId,
      });

      return {
        data: amenities.map(serializeAmenity),
        meta: { count: amenities.length },
      };
    },
  );

  app.post(
    "/v1/settings/properties/:propertyId/amenities",
    {
      schema: buildRouteSchema({
        tag: AMENITIES_TAG,
        summary: "Create a property amenity",
        params: ParamsSchema,
        body: createAmenityBody,
        response: {
          201: amenityResponse,
          409: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      }),
    },
    async (request, reply) => {
      if (!enforceScope(request, reply, "settings:write")) {
        return;
      }

      const { propertyId } = PropertyParamsSchema.parse(request.params);
      const body = CreateAmenityBodySchema.parse(request.body);

      try {
        const result = await createAmenity({
          tenantId: request.authUser.tenantId,
          propertyId,
          createdBy: request.authUser.sub,
          payload: {
            ...body,
            amenityCode: body.amenityCode.toUpperCase(),
          },
        });

        return reply.status(201).send({ data: serializeAmenity(result) });
      } catch (error) {
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply
              .status(409)
              .send({ message: `Amenity ${body.amenityCode} already exists` });
          }
        }
        request.log.error({ err: error }, "Failed to create amenity");
        return reply.status(500).send({ message: "Failed to create amenity" });
      }
    },
  );

  app.put(
    "/v1/settings/properties/:propertyId/amenities/:amenityCode",
    {
      schema: buildRouteSchema({
        tag: AMENITIES_TAG,
        summary: "Update a property amenity",
        params: AmenityParamsJson,
        body: updateAmenityBody,
        response: {
          200: amenityResponse,
          404: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
          },
        },
      }),
    },
    async (request, reply) => {
      if (!enforceScope(request, reply, "settings:write")) {
        return;
      }

      const { propertyId, amenityCode } = AmenityParamsSchema.parse(request.params);
      const body = UpdateAmenityBodySchema.parse(request.body ?? {});

      const updated = await updateAmenity({
        tenantId: request.authUser.tenantId,
        propertyId,
        amenityCode: amenityCode.toUpperCase(),
        updatedBy: request.authUser.sub,
        payload: body,
      });

      if (!updated) {
        return reply
          .status(404)
          .send({ message: `Amenity ${amenityCode} not found for property ${propertyId}` });
      }

      return { data: serializeAmenity(updated) };
    },
  );
};

export default fp(amenitiesRoutes, {
  name: "amenity-catalog-routes",
});
