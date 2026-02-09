/**
 * DEV DOC
 * Module: routes/rates.ts
 * Purpose: Rate CRUD API routes for rooms-service
 * Ownership: rooms-service
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { RateItemSchema, RateStatusEnum, RateStrategyEnum, RateTypeEnum } from "@tartware/schemas";
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

const RateListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  room_type_id: z.string().uuid().optional(),
  status: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value || RateStatusEnum.options.includes(value as (typeof RateStatusEnum.options)[number]),
      { message: "Invalid rate status" },
    ),
  rate_type: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value || RateTypeEnum.options.includes(value as (typeof RateTypeEnum.options)[number]),
      { message: "Invalid rate type" },
    ),
  search: z.string().min(1).max(80).optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

type RateListQuery = z.infer<typeof RateListQuerySchema>;

const RateListResponseSchema = z.array(RateItemSchema);
const RateListQueryJsonSchema = schemaFromZod(RateListQuerySchema, "RateListQuery");
const RateListResponseJsonSchema = schemaFromZod(RateListResponseSchema, "RateListResponse");

const CreateRateBodySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  rate_name: z.string().min(1).max(255),
  rate_code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, {
      message: "Rate code must be alphanumeric (with _ or -)",
    })
    .transform((value) => value.toUpperCase()),
  description: z.string().max(1000).optional(),
  rate_type: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value || RateTypeEnum.options.includes(value as (typeof RateTypeEnum.options)[number]),
      { message: "Invalid rate type" },
    ),
  strategy: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        RateStrategyEnum.options.includes(value as (typeof RateStrategyEnum.options)[number]),
      { message: "Invalid rate strategy" },
    ),
  priority: z.number().int().min(0).max(999).optional(),
  base_rate: z.number().min(0),
  currency: z.string().length(3).optional(),
  single_occupancy_rate: z.number().min(0).optional(),
  double_occupancy_rate: z.number().min(0).optional(),
  extra_person_rate: z.number().min(0).optional(),
  extra_child_rate: z.number().min(0).optional(),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date must be YYYY-MM-DD format",
  }),
  valid_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD format" })
    .optional(),
  advance_booking_days_min: z.number().int().min(0).optional(),
  advance_booking_days_max: z.number().int().min(0).optional(),
  min_length_of_stay: z.number().int().min(1).optional(),
  max_length_of_stay: z.number().int().min(1).optional(),
  closed_to_arrival: z.boolean().optional(),
  closed_to_departure: z.boolean().optional(),
  meal_plan: z.string().max(50).optional(),
  meal_plan_cost: z.number().min(0).optional(),
  cancellation_policy: z.record(z.unknown()).optional(),
  modifiers: z.record(z.unknown()).optional(),
  channels: z.array(z.string()).optional(),
  customer_segments: z.array(z.string()).optional(),
  tax_inclusive: z.boolean().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  status: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value || RateStatusEnum.options.includes(value as (typeof RateStatusEnum.options)[number]),
      { message: "Invalid rate status" },
    ),
  display_order: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type CreateRateBody = z.infer<typeof CreateRateBodySchema>;

const UpdateRateBodySchema = CreateRateBodySchema.partial().extend({
  tenant_id: z.string().uuid(),
});

type UpdateRateBody = z.infer<typeof UpdateRateBodySchema>;

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
        return reply.status(404).send({ message: "Rate not found" });
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
            return reply.status(409).send({
              message: "Rate code already exists for this property",
            });
          }
        }
        request.log.error({ err: error }, "Failed to create rate");
        return reply.status(500).send({ message: "Failed to create rate" });
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
          return reply.status(404).send({ message: "Rate not found" });
        }

        return reply.send(updated);
      } catch (error) {
        if (typeof error === "object" && error && "code" in error) {
          const code = (error as { code?: string }).code;
          if (code === "23505") {
            return reply.status(409).send({
              message: "Rate code already exists for this property",
            });
          }
        }
        request.log.error({ err: error }, "Failed to update rate");
        return reply.status(500).send({ message: "Failed to update rate" });
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
        return reply.status(404).send({ message: "Rate not found" });
      }

      return reply.status(204).send();
    },
  );
};
