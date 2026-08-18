import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  MaintenanceIssueCategoryEnum,
  MaintenancePriorityEnum,
  MaintenanceRequestListItemSchema,
  MaintenanceRequestStatusEnum,
  OperationsMaintenanceAssignCommandSchema,
  OperationsMaintenanceCompleteCommandSchema,
  OperationsMaintenanceEscalateCommandSchema,
  OperationsMaintenanceRequestCommandSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getMaintenanceRequestById,
  listMaintenanceRequests,
} from "../services/housekeeping-service.js";
import {
  assignMaintenanceRequest,
  completeMaintenanceRequest,
  createMaintenanceRequest,
  escalateMaintenanceRequest,
} from "../services/maintenance-command-service.js";

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

const ErrorResponseSchema = schemaFromZod(
  z.object({ type: z.string(), title: z.string(), status: z.number(), detail: z.string() }),
  "ErrorResponse",
);

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

  /* ── Writes ──────────────────────────────────────────────────────────────
   *
   * Maintenance was read-only end to end: two GETs here, an `app.get`
   * wildcard at the gateway, and four `operations.maintenance.*` commands that
   * were handled but that nothing could dispatch. A guest reported a fault and
   * there was no way to log it, while `/v1/reports/maintenance-sla` reported on
   * a table nothing could fill.
   *
   * These are HTTP rather than a gateway command wrapper because
   * ui-gaps/18-write-path-gap.md's rule puts them there: every one of the four
   * writes touches `maintenance_requests` in this service alone — one owner, one
   * table, no fan-out, no outbox. That is the same call that deleted the sibling
   * `operations.incident.report` on 2026-08-13 in favour of the plain HTTP
   * incident routes next door, and these routes deliberately mirror those.
   *
   * The service functions are reused unchanged, so the command handlers and
   * these routes cannot drift; the commands themselves become retirable — see
   * ui-gaps/17-command-reachability.md.
   */

  /** `tenant_id` is not part of any command payload — on the bus it rides on the
   *  envelope metadata. An HTTP caller supplies it in the body instead, so it is
   *  extracted separately and the command schema parses the rest. */
  const TenantBodySchema = z.object({ tenant_id: z.string().uuid() });

  /** The command services resolve the actor themselves, but an unauthenticated
   *  write would record a null actor on a compliance-relevant log. */
  const requireActor = (request: { auth?: { userId?: string | null } }): string | null =>
    request.auth?.userId ?? null;

  app.post(
    "/v1/maintenance/requests",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: MAINTENANCE_TAG,
        summary: "Raise a maintenance request",
        description:
          "Logs a fault against a room or area. The request number is generated server-side.",
      }),
    },
    async (request, reply) => {
      const { tenant_id } = TenantBodySchema.parse(request.body);
      const body = OperationsMaintenanceRequestCommandSchema.parse(request.body);
      const actorId = requireActor(request);
      if (!actorId) {
        return reply.badRequest("An authenticated user is required to raise a request.");
      }
      const requestId = await createMaintenanceRequest(body, {
        tenantId: tenant_id,
        initiatedBy: { userId: actorId },
      });
      return reply.status(201).send({ request_id: requestId });
    },
  );

  app.post(
    "/v1/maintenance/requests/:requestId/assign",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: MAINTENANCE_TAG,
        summary: "Assign a maintenance request to a technician",
      }),
    },
    async (request, reply) => {
      const { requestId } = MaintenanceRequestParamsSchema.parse(request.params);
      const { tenant_id } = TenantBodySchema.parse(request.body);
      const body = OperationsMaintenanceAssignCommandSchema.parse({
        ...(request.body as Record<string, unknown>),
        request_id: requestId,
      });
      const actorId = requireActor(request);
      if (!actorId) {
        return reply.badRequest("An authenticated user is required to assign a request.");
      }
      await assignMaintenanceRequest(body, {
        tenantId: tenant_id,
        initiatedBy: { userId: actorId },
      });
      return reply.status(204).send();
    },
  );

  app.post(
    "/v1/maintenance/requests/:requestId/complete",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: MAINTENANCE_TAG,
        summary: "Complete a maintenance request",
        description: "Records labour and parts cost; the service derives the total.",
      }),
    },
    async (request, reply) => {
      const { requestId } = MaintenanceRequestParamsSchema.parse(request.params);
      const { tenant_id } = TenantBodySchema.parse(request.body);
      const body = OperationsMaintenanceCompleteCommandSchema.parse({
        ...(request.body as Record<string, unknown>),
        request_id: requestId,
      });
      const actorId = requireActor(request);
      if (!actorId) {
        return reply.badRequest("An authenticated user is required to complete a request.");
      }
      await completeMaintenanceRequest(body, {
        tenantId: tenant_id,
        initiatedBy: { userId: actorId },
      });
      return reply.status(204).send();
    },
  );

  app.post(
    "/v1/maintenance/requests/:requestId/escalate",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: MAINTENANCE_TAG,
        summary: "Escalate a maintenance request",
      }),
    },
    async (request, reply) => {
      const { requestId } = MaintenanceRequestParamsSchema.parse(request.params);
      const { tenant_id } = TenantBodySchema.parse(request.body);
      const body = OperationsMaintenanceEscalateCommandSchema.parse({
        ...(request.body as Record<string, unknown>),
        request_id: requestId,
      });
      const actorId = requireActor(request);
      if (!actorId) {
        return reply.badRequest("An authenticated user is required to escalate a request.");
      }
      await escalateMaintenanceRequest(body, {
        tenantId: tenant_id,
        initiatedBy: { userId: actorId },
      });
      return reply.status(204).send();
    },
  );
};
