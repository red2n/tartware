import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";

import {
  AmenityConflictError,
  AmenityNotFoundError,
  createAmenity,
  listAmenityCatalog,
  modifyAmenity,
} from "../services/amenities-service.js";

const propertyParamSchema = z.object({
  propertyId: z.string().uuid(),
});

const amenityParamSchema = propertyParamSchema.extend({
  amenityCode: z.string().min(1).max(100),
});

const listQuerySchema = z.object({
  tenantId: z.string().uuid(),
  includeInactive: z.coerce.boolean().optional().default(false),
});

const metadataSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length <= 64, "Metadata cannot exceed 64 top-level keys");

const createBodySchema = z.object({
  tenantId: z.string().uuid(),
  amenityCode: z.string().min(1).max(100),
  amenityName: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  icon: z.string().max(100).optional(),
  rank: z.coerce.number().int().min(0).optional(),
  metadata: metadataSchema.optional(),
});

const updateBodySchema = z
  .object({
    tenantId: z.string().uuid(),
    amenityName: z.string().min(1).max(255).optional(),
    category: z.string().min(1).max(100).optional(),
    description: z.string().max(2000).optional(),
    icon: z.string().max(100).optional(),
    rank: z.coerce.number().int().min(0).optional(),
    metadata: metadataSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.amenityName !== undefined ||
      value.category !== undefined ||
      value.description !== undefined ||
      value.icon !== undefined ||
      value.rank !== undefined ||
      value.metadata !== undefined ||
      value.isActive !== undefined,
    {
      message: "At least one mutable field must be provided",
      path: [],
    },
  );

/**
 * Fastify routes that expose CRUD operations for the amenity catalog.
 */
const amenitiesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/settings/properties/:propertyId/amenities", async (request) => {
    const { propertyId } = propertyParamSchema.parse(request.params);
    const { tenantId, includeInactive } = listQuerySchema.parse(request.query);

    const amenities = await listAmenityCatalog({
      propertyId,
      tenantId,
      includeInactive,
    });

    return {
      data: amenities,
      meta: {
        count: amenities.length,
        includeInactive,
      },
    };
  });

  app.post("/v1/settings/properties/:propertyId/amenities", async (request, reply) => {
    const { propertyId } = propertyParamSchema.parse(request.params);
    const body = createBodySchema.parse(request.body);

    try {
      const amenity = await createAmenity({
        tenantId: body.tenantId,
        propertyId,
        amenityCode: body.amenityCode,
        amenityName: body.amenityName,
        category: body.category,
        description: body.description,
        icon: body.icon,
        rank: body.rank,
        metadata: body.metadata,
        isDefault: false,
      });
      return reply.code(201).send({ data: amenity });
    } catch (error) {
      if (error instanceof AmenityConflictError) {
        return reply.status(409).send({ message: error.message });
      }
      throw error;
    }
  });

  app.patch(
    "/v1/settings/properties/:propertyId/amenities/:amenityCode",
    async (request, reply) => {
      const { propertyId, amenityCode } = amenityParamSchema.parse(request.params);
      const body = updateBodySchema.parse(request.body);

      try {
        const amenity = await modifyAmenity({
          tenantId: body.tenantId,
          propertyId,
          amenityCode,
          amenityName: body.amenityName,
          category: body.category,
          description: body.description,
          icon: body.icon,
          rank: body.rank,
          metadata: body.metadata,
          isActive: body.isActive,
        });
        return { data: amenity };
      } catch (error) {
        if (error instanceof AmenityNotFoundError) {
          return reply.status(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );
};

export default fp(amenitiesRoutes, {
  name: "amenity-catalog-routes",
});
