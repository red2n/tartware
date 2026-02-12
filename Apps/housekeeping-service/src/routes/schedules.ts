import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type HousekeepingScheduleListQuery,
  HousekeepingScheduleListQuerySchema,
  HousekeepingScheduleListResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { listHousekeepingSchedules } from "../services/housekeeping-service.js";

const ScheduleListQueryJsonSchema = schemaFromZod(
  HousekeepingScheduleListQuerySchema,
  "ScheduleListQuery",
);
const ScheduleListResponseJsonSchema = schemaFromZod(
  HousekeepingScheduleListResponseSchema,
  "ScheduleListResponse",
);

const SCHEDULE_TAG = "Housekeeping Schedules";

export const registerScheduleRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: HousekeepingScheduleListQuery }>(
    "/v1/housekeeping/schedules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as HousekeepingScheduleListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: SCHEDULE_TAG,
        summary: "List housekeeping schedules",
        description:
          "Retrieves housekeeping tasks that have scheduled dates, with optional date range filtering",
        querystring: ScheduleListQueryJsonSchema,
        response: {
          200: ScheduleListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, date_from, date_to, limit, offset } =
        HousekeepingScheduleListQuerySchema.parse(request.query);

      const schedules = await listHousekeepingSchedules({
        tenantId: tenant_id,
        propertyId: property_id,
        dateFrom: date_from,
        dateTo: date_to,
        limit,
        offset,
      });

      return HousekeepingScheduleListResponseSchema.parse(schedules);
    },
  );
};
