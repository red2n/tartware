import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  MaintenanceIssueCategoryEnum,
  MaintenancePriorityEnum,
  MaintenanceRequestListItemSchema,
  MaintenanceRequestStatusEnum,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getMaintenanceRequestById,
  listMaintenanceRequests,
} from "../services/housekeeping-service.js";

const MaintenanceListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        MaintenanceRequestStatusEnum.options.includes(
          value as (typeof MaintenanceRequestStatusEnum.options)[number],
        ),
      { message: "Invalid maintenance request status" },
    ),
  priority: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        MaintenancePriorityEnum.options.includes(
          value as (typeof MaintenancePriorityEnum.options)[number],
        ),
      { message: "Invalid maintenance priority" },
    ),
  issue_category: z
    .string()
    .toUpperCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        MaintenanceIssueCategoryEnum.options.includes(
          value as (typeof MaintenanceIssueCategoryEnum.options)[number],
        ),
      { message: "Invalid issue category" },
    ),
  room_id: z.string().uuid().optional(),
  room_out_of_service: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

type MaintenanceListQuery = z.infer<typeof MaintenanceListQuerySchema>;

const MaintenanceRequestParamsSchema = z.object({
  requestId: z.string().uuid(),
});

const MaintenanceListResponseSchema = z.array(MaintenanceRequestListItemSchema);

const MaintenanceListQueryJsonSchema = schemaFromZod(
  MaintenanceListQuerySchema,
  "MaintenanceListQuery",
);
const MaintenanceListResponseJsonSchema = schemaFromZod(
  MaintenanceListResponseSchema,
  "MaintenanceListResponse",
);
const MaintenanceRequestItemJsonSchema = schemaFromZod(
  MaintenanceRequestListItemSchema,
  "MaintenanceRequestListItem",
);
const MaintenanceRequestParamsJsonSchema = schemaFromZod(
  MaintenanceRequestParamsSchema,
  "MaintenanceRequestParams",
);

const ErrorResponseSchema = schemaFromZod(z.object({ message: z.string() }), "ErrorResponse");

const MAINTENANCE_TAG = "Maintenance";

export const registerMaintenanceRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: MaintenanceListQuery }>(
    "/v1/maintenance/requests",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as MaintenanceListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: MAINTENANCE_TAG,
        summary: "List maintenance requests",
        description:
          "Retrieves maintenance work orders with filtering by status, priority, category, and room",
        querystring: MaintenanceListQueryJsonSchema,
        response: {
          200: MaintenanceListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        status,
        priority,
        issue_category,
        room_id,
        room_out_of_service,
        limit,
        offset,
      } = MaintenanceListQuerySchema.parse(request.query);

      const requests = await listMaintenanceRequests({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        priority,
        issueCategory: issue_category,
        roomId: room_id,
        roomOutOfService: room_out_of_service,
        limit,
        offset,
      });

      return MaintenanceListResponseSchema.parse(requests);
    },
  );

  app.get<{
    Params: { requestId: string };
    Querystring: { tenant_id: string };
  }>(
    "/v1/maintenance/requests/:requestId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: MAINTENANCE_TAG,
        summary: "Get maintenance request by ID",
        description: "Retrieves detailed information for a specific maintenance request",
        params: MaintenanceRequestParamsJsonSchema,
        querystring: schemaFromZod(z.object({ tenant_id: z.string().uuid() }), "TenantQuery"),
        response: {
          200: MaintenanceRequestItemJsonSchema,
          404: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const { requestId } = MaintenanceRequestParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const maintenanceRequest = await getMaintenanceRequestById({
        requestId,
        tenantId: tenant_id,
      });

      if (!maintenanceRequest) {
        return reply.notFound("Maintenance request not found");
      }

      return MaintenanceRequestListItemSchema.parse(maintenanceRequest);
    },
  );
};
