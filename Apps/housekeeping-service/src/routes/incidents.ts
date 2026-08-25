import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import type { IncidentStatusBody, IncidentUpdateBody, IncidentWriteBody } from "@tartware/schemas";
import {
  IncidentReportDetailSchema,
  IncidentReportListItemSchema,
  IncidentSeverityEnum,
  IncidentStatusBodySchema,
  IncidentStatusEnum,
  IncidentTypeEnum,
  IncidentUpdateBodySchema,
  IncidentWriteBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createIncidentReport,
  getIncidentReportById,
  listIncidentReports,
  updateIncidentReport,
  updateIncidentStatus,
} from "../services/housekeeping-service.js";

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
  offset: z.coerce.number().int().min(0).default(0),
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
const IncidentReportDetailJsonSchema = schemaFromZod(
  IncidentReportDetailSchema,
  "IncidentReportDetail",
);
const IncidentParamsJsonSchema = schemaFromZod(IncidentParamsSchema, "IncidentParams");

const ErrorResponseSchema = schemaFromZod(
  z.object({ type: z.string(), title: z.string(), status: z.number(), detail: z.string() }),
  "ErrorResponse",
);

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
        offset,
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
        offset,
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
          200: IncidentReportDetailJsonSchema,
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
        return reply.notFound("Incident report not found");
      }

      return IncidentReportDetailSchema.parse(incident);
    },
  );

  /**
   * Write surface. This register was read-only — two GETs over a table nothing
   * could write to — so incidents lived on paper and the table stayed empty.
   * See ui-gaps/06-incidents.md.
   *
   * Enum values are lowercase to match the table's CHECK constraints, which are
   * the source of truth here.
   */
  const toWriteInput = (body: IncidentUpdateBody) => ({
    propertyId: body.property_id as string,
    incidentTitle: body.incident_title as string,
    incidentType: body.incident_type,
    severity: body.severity,
    incidentDate: body.incident_date as string,
    incidentTime: body.incident_time as string,
    incidentLocation: body.incident_location as string,
    incidentDescription: body.incident_description as string,
    immediateActionsTaken: body.immediate_actions_taken as string,
    incidentCategory: body.incident_category,
    roomNumber: body.room_number,
    areaName: body.area_name,
    guestInvolved: body.guest_involved,
    staffInvolved: body.staff_involved,
    injurySeverity: body.injury_severity,
    policeNotified: body.police_notified,
    severityScore: body.severity_score,
    discoveredByName: body.discovered_by_name,
  });

  /**
   * `incident_reports.created_by` is NOT NULL: an incident record whose author is
   * unknown is not worth having, so a request without an authenticated user is
   * refused rather than attributed to a placeholder.
   *
   * The actor lives on `request.auth.userId` — that is what the shared auth
   * plugin decorates. This previously read a bare `request.userId`, which no
   * plugin sets, so every write refused with "An authenticated user is
   * required" no matter who called it and the register stayed empty.
   */
  const requireActor = (request: { auth?: { userId?: string | null } }): string | null =>
    request.auth?.userId ?? null;

  app.post<{ Body: IncidentWriteBody }>(
    "/v1/incidents",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: INCIDENTS_TAG,
        summary: "Report an incident",
        description:
          "Files a guest or property incident. The incident number is generated server-side.",
      }),
    },
    async (request, reply) => {
      const body = IncidentWriteBodySchema.parse(request.body);
      const actorId = requireActor(request);
      if (!actorId) {
        return reply.badRequest("An authenticated user is required to file an incident.");
      }
      const incident = await createIncidentReport(
        body.tenant_id,
        { ...toWriteInput(body), incidentType: body.incident_type, severity: body.severity },
        actorId,
      );
      if (!incident) {
        return reply.internalServerError("Failed to file incident");
      }
      return reply.status(201).send(IncidentReportDetailSchema.parse(incident));
    },
  );

  app.put<{ Params: { incidentId: string }; Body: IncidentUpdateBody }>(
    "/v1/incidents/:incidentId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: INCIDENTS_TAG,
        summary: "Correct an incident report",
      }),
    },
    async (request, reply) => {
      const body = IncidentUpdateBodySchema.parse(request.body);
      const actorId = requireActor(request);
      if (!actorId) {
        return reply.badRequest("An authenticated user is required to amend an incident.");
      }
      const incident = await updateIncidentReport(
        body.tenant_id,
        request.params.incidentId,
        toWriteInput(body),
        actorId,
      );
      if (!incident) {
        return reply.notFound("Incident report not found");
      }
      return IncidentReportDetailSchema.parse(incident);
    },
  );

  app.post<{ Params: { incidentId: string }; Body: IncidentStatusBody }>(
    "/v1/incidents/:incidentId/status",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: INCIDENTS_TAG,
        summary: "Move an incident through its status",
        description:
          "A terminal status (resolved, closed) stamps closed/closed_at/closed_by so time-to-close stays answerable.",
      }),
    },
    async (request, reply) => {
      const body = IncidentStatusBodySchema.parse(request.body);
      const actorId = requireActor(request);
      if (!actorId) {
        return reply.badRequest("An authenticated user is required to change incident status.");
      }
      const incident = await updateIncidentStatus(
        body.tenant_id,
        request.params.incidentId,
        { incidentStatus: body.incident_status, closureNotes: body.closure_notes },
        actorId,
      );
      if (!incident) {
        return reply.notFound("Incident report not found");
      }
      return IncidentReportDetailSchema.parse(incident);
    },
  );
};
