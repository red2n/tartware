/**
 * DEV DOC
 * Module: routes/rate-calendar.ts
 * Purpose: Rate Calendar API routes (day-level pricing grid)
 * Ownership: rooms-service
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type RateCalendarBulkUpsertBody,
  RateCalendarBulkUpsertBodySchema,
  type RateCalendarQuery,
  RateCalendarQuerySchema,
  type RateCalendarRangeFillBody,
  RateCalendarRangeFillBodySchema,
  RateCalendarResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  bulkUpsertRateCalendar,
  listRateCalendar,
  rangeFillRateCalendar,
} from "../services/rate-calendar-service.js";

const TAG = "Rate Calendar";

const QueryJsonSchema = schemaFromZod(RateCalendarQuerySchema, "RateCalendarQuery");
const ResponseJsonSchema = schemaFromZod(RateCalendarResponseSchema, "RateCalendarResponse");
const BulkUpsertBodyJsonSchema = schemaFromZod(
  RateCalendarBulkUpsertBodySchema,
  "RateCalendarBulkUpsertBody",
);
const RangeFillBodyJsonSchema = schemaFromZod(
  RateCalendarRangeFillBodySchema,
  "RateCalendarRangeFillBody",
);
const ErrorResponseSchema = schemaFromZod(
  z.object({ type: z.string(), title: z.string(), status: z.number(), detail: z.string() }),
  "RateCalendarErrorResponse",
);

export const registerRateCalendarRoutes = (app: FastifyInstance): void => {
  /**
   * List rate calendar entries for a date range.
   */
  app.get<{ Querystring: RateCalendarQuery }>(
    "/v1/rate-calendar",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as RateCalendarQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "List rate calendar entries",
        description:
          "Returns day-level rates for a property within a date range. Optionally filter by room type, rate plan, or status.",
        querystring: QueryJsonSchema,
        response: {
          200: ResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const q = RateCalendarQuerySchema.parse(request.query);
      return listRateCalendar({
        tenantId: q.tenant_id,
        propertyId: q.property_id,
        startDate: q.start_date,
        endDate: q.end_date,
        roomTypeId: q.room_type_id,
        rateId: q.rate_id,
        status: q.status,
      });
    },
  );

  /**
   * Bulk upsert individual day entries.
   */
  app.put<{ Body: RateCalendarBulkUpsertBody }>(
    "/v1/rate-calendar",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as RateCalendarBulkUpsertBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Bulk upsert rate calendar days",
        description:
          "Create or update individual day-level rates. Uses upsert (ON CONFLICT) semantics.",
        body: BulkUpsertBodyJsonSchema,
        response: {
          200: ResponseJsonSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = RateCalendarBulkUpsertBodySchema.parse(request.body);
      try {
        const upserted = await bulkUpsertRateCalendar(body, request.auth.userId ?? undefined);
        return upserted;
      } catch (error) {
        request.log.error({ err: error }, "Failed to upsert rate calendar");
        return reply.internalServerError("Failed to update rate calendar");
      }
    },
  );

  /**
   * Fill a date range with a uniform rate.
   */
  app.post<{ Body: RateCalendarRangeFillBody }>(
    "/v1/rate-calendar/range-fill",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as RateCalendarRangeFillBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Fill date range with uniform rate",
        description:
          "Set the same rate amount for every day in a date range. Useful for seasonal pricing or bulk setup.",
        body: RangeFillBodyJsonSchema,
        response: {
          200: ResponseJsonSchema,
          500: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = RateCalendarRangeFillBodySchema.parse(request.body);
      try {
        const filled = await rangeFillRateCalendar(body, request.auth.userId ?? undefined);
        return filled;
      } catch (error) {
        request.log.error({ err: error }, "Failed to fill rate calendar range");
        return reply.internalServerError("Failed to fill rate calendar range");
      }
    },
  );
};
