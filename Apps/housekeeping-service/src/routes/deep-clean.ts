import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type DeepCleanDueQuery,
  DeepCleanDueQuerySchema,
  DeepCleanDueResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { listDeepCleanDueRooms } from "../services/housekeeping-service.js";

const DeepCleanDueQueryJsonSchema = schemaFromZod(DeepCleanDueQuerySchema, "DeepCleanDueQuery");
const DeepCleanDueResponseJsonSchema = schemaFromZod(
  DeepCleanDueResponseSchema,
  "DeepCleanDueResponse",
);

const DEEP_CLEAN_TAG = "Housekeeping Deep Clean";

export const registerDeepCleanRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: DeepCleanDueQuery }>(
    "/v1/housekeeping/deep-clean-due",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DeepCleanDueQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: DEEP_CLEAN_TAG,
        summary: "List rooms due for deep cleaning",
        description:
          "Returns rooms where last_deep_clean_date is null or the configured deep_clean_interval_days has elapsed. Sorted by most overdue first.",
        querystring: DeepCleanDueQueryJsonSchema,
        response: {
          200: DeepCleanDueResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, limit, offset } = DeepCleanDueQuerySchema.parse(
        request.query,
      );

      return listDeepCleanDueRooms({
        tenantId: tenant_id,
        propertyId: property_id,
        limit,
        offset,
      });
    },
  );
};
