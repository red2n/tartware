import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { HousekeepingStatusEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { HousekeepingTaskSchema, listHousekeepingTasks } from "../services/housekeeping-service.js";

const HousekeepingListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value || HousekeepingStatusEnum.options.map((s) => s.toLowerCase()).includes(value),
      { message: "Invalid housekeeping status" },
    ),
  scheduled_date: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "scheduled_date must be a valid ISO date string",
    }),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

type HousekeepingListQuery = z.infer<typeof HousekeepingListQuerySchema>;

const HousekeepingListResponseSchema = z.array(HousekeepingTaskSchema);
const HousekeepingListQueryJsonSchema = schemaFromZod(
  HousekeepingListQuerySchema,
  "HousekeepingListQuery",
);
const HousekeepingListResponseJsonSchema = schemaFromZod(
  HousekeepingListResponseSchema,
  "HousekeepingListResponse",
);

const HOUSEKEEPING_TAG = "Housekeeping";

export const registerHousekeepingRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: HousekeepingListQuery }>(
    "/v1/housekeeping/tasks",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as HousekeepingListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_TAG,
        summary: "List housekeeping tasks",
        querystring: HousekeepingListQueryJsonSchema,
        response: {
          200: HousekeepingListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, status, scheduled_date, limit } =
        HousekeepingListQuerySchema.parse(request.query);

      const tasks = await listHousekeepingTasks({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        scheduledDate: scheduled_date,
        limit,
      });

      return HousekeepingListResponseSchema.parse(tasks);
    },
  );
};
