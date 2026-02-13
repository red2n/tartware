import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type HousekeepingInspectionListQuery,
  HousekeepingInspectionListQuerySchema,
  HousekeepingInspectionListResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { listHousekeepingInspections } from "../services/housekeeping-service.js";

const InspectionListQueryJsonSchema = schemaFromZod(
  HousekeepingInspectionListQuerySchema,
  "InspectionListQuery",
);
const InspectionListResponseJsonSchema = schemaFromZod(
  HousekeepingInspectionListResponseSchema,
  "InspectionListResponse",
);

const INSPECTION_TAG = "Housekeeping Inspections";

export const registerInspectionRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: HousekeepingInspectionListQuery }>(
    "/v1/housekeeping/inspections",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as HousekeepingInspectionListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: INSPECTION_TAG,
        summary: "List housekeeping inspections",
        description:
          "Retrieves housekeeping tasks that have been inspected, with optional pass/fail and date range filtering",
        querystring: InspectionListQueryJsonSchema,
        response: {
          200: InspectionListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, passed, date_from, date_to, limit, offset } =
        HousekeepingInspectionListQuerySchema.parse(request.query);

      const inspections = await listHousekeepingInspections({
        tenantId: tenant_id,
        propertyId: property_id,
        passed,
        dateFrom: date_from,
        dateTo: date_to,
        limit,
        offset,
      });

      return HousekeepingInspectionListResponseSchema.parse(inspections);
    },
  );
};
