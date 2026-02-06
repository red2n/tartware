import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  IncidentReportListItemSchema,
  IncidentSeverityEnum,
  IncidentStatusEnum,
  IncidentTypeEnum,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getIncidentReportById, listIncidentReports } from "../services/housekeeping-service.js";

const IncidentListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        IncidentStatusEnum.options.includes(value as (typeof IncidentStatusEnum.options)[number]),
      { message: "Invalid incident status" },
    ),
  severity: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        IncidentSeverityEnum.options.includes(
          value as (typeof IncidentSeverityEnum.options)[number],
        ),
      { message: "Invalid severity level" },
    ),
  incident_type: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        IncidentTypeEnum.options.includes(value as (typeof IncidentTypeEnum.options)[number]),
      { message: "Invalid incident type" },
    ),
  incident_date: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "incident_date must be a valid ISO date string",
    }),
  date_from: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "date_from must be a valid ISO date string",
    }),
  date_to: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "date_to must be a valid ISO date string",
    }),
  limit: z.coerce.number().int().positive().max(500).default(200),
});

type IncidentListQuery = z.infer<typeof IncidentListQuerySchema>;

const IncidentParamsSchema = z.object({
  incidentId: z.string().uuid(),
});

const IncidentListResponseSchema = z.array(IncidentReportListItemSchema);

const IncidentListQueryJsonSchema = schemaFromZod(IncidentListQuerySchema, "IncidentListQuery");
const IncidentListResponseJsonSchema = schemaFromZod(
  IncidentListResponseSchema,
  "IncidentListResponse",
);
const IncidentReportItemJsonSchema = schemaFromZod(
  IncidentReportListItemSchema,
  "IncidentReportListItem",
);
const IncidentParamsJsonSchema = schemaFromZod(IncidentParamsSchema, "IncidentParams");

const ErrorResponseSchema = schemaFromZod(z.object({ message: z.string() }), "ErrorResponse");

const INCIDENTS_TAG = "Incidents";

export const registerIncidentRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: IncidentListQuery }>(
    "/v1/incidents",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as IncidentListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: INCIDENTS_TAG,
        summary: "List incident reports",
        description:
          "Retrieves incident reports with filtering by status, severity, type, and date range",
        querystring: IncidentListQueryJsonSchema,
        response: {
          200: IncidentListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        status,
        severity,
        incident_type,
        incident_date,
        date_from,
        date_to,
        limit,
      } = IncidentListQuerySchema.parse(request.query);

      const incidents = await listIncidentReports({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        severity,
        incidentType: incident_type,
        incidentDate: incident_date,
        dateFrom: date_from,
        dateTo: date_to,
        limit,
      });

      return IncidentListResponseSchema.parse(incidents);
    },
  );

  app.get<{
    Params: { incidentId: string };
    Querystring: { tenant_id: string };
  }>(
    "/v1/incidents/:incidentId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: INCIDENTS_TAG,
        summary: "Get incident report by ID",
        description: "Retrieves detailed information for a specific incident report",
        params: IncidentParamsJsonSchema,
        querystring: schemaFromZod(z.object({ tenant_id: z.string().uuid() }), "TenantQuery"),
        response: {
          200: IncidentReportItemJsonSchema,
          404: ErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const { incidentId } = IncidentParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const incident = await getIncidentReportById({
        incidentId,
        tenantId: tenant_id,
      });

      if (!incident) {
        return reply.status(404).send({ message: "Incident report not found" });
      }

      return IncidentReportListItemSchema.parse(incident);
    },
  );
};
