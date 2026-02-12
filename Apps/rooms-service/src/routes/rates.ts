/**
 * DEV DOC
 * Module: routes/rates.ts
 * Purpose: Rate CRUD API routes for rooms-service
 * Ownership: rooms-service
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type CreateRateBody,
  CreateRateBodySchema,
  RateItemSchema,
  type RateListQuery,
  RateListQuerySchema,
  RateListResponseSchema,
  type UpdateRateBody,
  UpdateRateBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createRate,
  deleteRate,
  getRateById,
  listRates,
  updateRate,
} from "../services/rate-service.js";

const RATES_TAG = "Rates";

const RateListQueryJsonSchema = schemaFromZod(RateListQuerySchema, "RateListQuery");
const RateListResponseJsonSchema = schemaFromZod(RateListResponseSchema, "RateListResponse");

const CreateRateBodyJsonSchema = schemaFromZod(CreateRateBodySchema, "CreateRateBody");
const UpdateRateBodyJsonSchema = schemaFromZod(UpdateRateBodySchema, "UpdateRateBody");
const RateItemJsonSchema = schemaFromZod(RateItemSchema, "RateItem");
const ErrorResponseSchema = schemaFromZod(z.object({ message: z.string() }), "ErrorResponse");

const RateParamsSchema = z.object({
  rateId: z.string().uuid(),
});

export const registerRateRoutes = (app: FastifyInstance): void => {
  /**
   * List rates with optional filters
   */
  app.get<{ Querystring: RateListQuery }>(
    "/v1/rates",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as RateListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: RATES_TAG,
        summary: "List rates",
        description:
          "List rates for a tenant, with optional filters for property, room type, status, and rate type. Results are ordered by priority (ascending).",
        querystring: RateListQueryJsonSchema,
        response: {
          200: RateListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const query = RateListQuerySchema.parse(request.query);
      const rates = await listRates({
        tenantId: query.tenant_id,
        propertyId: query.property_id,
        roomTypeId: query.room_type_id,
        status: query.status,
        rateType: query.rate_type,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      });

      return RateListResponseSchema.parse(rates);
    },
  );

  /**
   * Get a rate by ID
   */
  app.get<{
    Params: { rateId: string };
    Querystring: { tenant_id: string };
  }>(
    "/v1/rates/:rateId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: RATES_TAG,
        summary: "Get rate by ID",
        params: schemaFromZod(RateParamsSchema, "RateParams"),
        querystring: schemaFromZod(z.object({ tenant_id: z.string().uuid() }), "RateGetQuery"),
        response: {
          200: RateItemJsonSchema,
          404: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = RateParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const rate = await getRateById({
        rateId: params.rateId,
        tenantId: tenant_id,
      });

      if (!rate) {
        return reply.notFound("Rate not found");
      }

      return rate;
    },
  );

  /**
   * Create a new rate
   */
  app.post<{ Body: CreateRateBody }>(
    "/v1/rates",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as CreateRateBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: RATES_TAG,
        summary: "Create a rate",
        description: "Create a new rate for a room type. Rate code must be unique per property.",
        body: CreateRateBodyJsonSchema,
        response: {
          201: RateItemJsonSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = CreateRateBodySchema.parse(request.body);
      try {
        const created = await createRate({
          ...body,
          created_by: request.auth.userId ?? undefined,
        });
        return reply.status(201).send(created);
      } catch (error) {
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply.conflict("Rate code already exists for this property");
          }
        }
        request.log.error({ err: error }, "Failed to create rate");
        return reply.internalServerError("Failed to create rate");
      }
    },
  );

  /**
   * Update a rate
   */
  app.put<{
    Params: { rateId: string };
    Body: UpdateRateBody;
  }>(
    "/v1/rates/:rateId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as UpdateRateBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: RATES_TAG,
        summary: "Update a rate",
        params: schemaFromZod(RateParamsSchema, "RateParams"),
        body: UpdateRateBodyJsonSchema,
        response: {
          200: RateItemJsonSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = RateParamsSchema.parse(request.params);
      const body = UpdateRateBodySchema.parse(request.body);

      try {
        const updated = await updateRate({
          ...body,
          rate_id: params.rateId,
          updated_by: request.auth.userId ?? undefined,
        });

        if (!updated) {
          return reply.notFound("Rate not found");
        }

        return reply.send(updated);
      } catch (error) {
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply.conflict("Rate code already exists for this property");
          }
        }
        request.log.error({ err: error }, "Failed to update rate");
        return reply.internalServerError("Failed to update rate");
      }
    },
  );

  /**
   * Delete a rate (soft delete)
   */
  app.delete<{
    Params: { rateId: string };
    Body: { tenant_id: string };
  }>(
    "/v1/rates/:rateId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: RATES_TAG,
        summary: "Delete a rate",
        description: "Soft delete a rate by ID.",
        params: schemaFromZod(RateParamsSchema, "RateParams"),
        body: schemaFromZod(z.object({ tenant_id: z.string().uuid() }), "DeleteRateBody"),
        response: {
          204: { type: "null" },
          404: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const params = RateParamsSchema.parse(request.params);
      const body = z.object({ tenant_id: z.string().uuid() }).parse(request.body);

      const deleted = await deleteRate({
        tenant_id: body.tenant_id,
        rate_id: params.rateId,
        deleted_by: request.auth.userId ?? undefined,
      });

      if (!deleted) {
        return reply.notFound("Rate not found");
      }

      return reply.status(204).send();
    },
  );
};
