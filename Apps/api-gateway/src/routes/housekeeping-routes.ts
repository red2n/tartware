/**
 * Housekeeping proxy and command routes.
 *
 * Read endpoints (GET) proxy to the housekeeping service for task
 * queries, incidents, and maintenance records. Write endpoints (POST)
 * dispatch commands through the Command Center for task assignment,
 * completion, creation, reassignment, reopening, note addition, and
 * bulk status updates.
 *
 * @module housekeeping-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import {
  forwardCommandWithParamId,
  forwardCommandWithTenant,
  forwardHousekeepingAssignCommand,
  forwardHousekeepingCompleteCommand,
} from "./command-helpers.js";
import { housekeepingTaskListResponse } from "./response-schemas.js";
import {
  CORE_PROXY_TAG,
  commandAcceptedSchema,
  HOUSEKEEPING_COMMAND_TAG,
  paginationQuerySchema,
  reservationParamsSchema,
  tenantTaskParamsSchema,
} from "./schemas.js";

/** Register housekeeping read-proxy and command-dispatch routes on the gateway. */
export const registerHousekeepingRoutes = (app: FastifyInstance): void => {
  const proxyHousekeeping = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.housekeepingServiceUrl);

  /** Write scope — aligned with command publisher's requiredRole: "MANAGER". */
  const tenantWriteScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "VIEWER",
    requiredModules: "core",
  });

  app.get(
    "/v1/housekeeping/tasks",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy housekeeping task queries to the housekeeping service.",
        querystring: paginationQuerySchema,
        response: {
          200: housekeepingTaskListResponse,
        },
      }),
    },
    proxyHousekeeping,
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks/:taskId/assign",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Assign a housekeeping task via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    forwardHousekeepingAssignCommand,
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks/:taskId/complete",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Complete a housekeeping task via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    forwardHousekeepingCompleteCommand,
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Create a housekeeping task via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "housekeeping.task.create",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks/:taskId/reassign",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Reassign a housekeeping task via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "housekeeping.task.reassign",
        paramKey: "taskId",
        payloadKey: "task_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks/:taskId/reopen",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Reopen a housekeeping task via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "housekeeping.task.reopen",
        paramKey: "taskId",
        payloadKey: "task_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks/:taskId/notes",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Add a housekeeping task note via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "housekeeping.task.add_note",
        paramKey: "taskId",
        payloadKey: "task_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks/bulk-status",
    {
      preHandler: tenantWriteScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Bulk update housekeeping tasks via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "housekeeping.task.bulk_status",
      }),
  );

  // Housekeeping catch-all
  app.get(
    "/v1/housekeeping/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy nested housekeeping routes to the service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyHousekeeping,
  );

  // Incidents routes - proxy to housekeeping service
  app.get(
    "/v1/incidents",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "List incidents.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyHousekeeping,
  );

  /**
   * Filing an incident POSTs to the bare path, and `/v1/incidents/*` does not
   * match it. Writes also carry `tenant_id` in the body, which a query-only
   * resolver cannot see — `withTenantScope` then rejects the request with
   * TENANT_ID_REQUIRED. Same trap as police-report filing.
   * See ui-gaps/06-incidents.md.
   */
  const tenantScopeFromQueryOrBody = app.withTenantScope({
    resolveTenantId: (request) =>
      (request.query as { tenant_id?: string })?.tenant_id ??
      (request.body as { tenant_id?: string } | undefined)?.tenant_id,
    minRole: "STAFF",
    requiredModules: "facility-maintenance",
  });

  app.post(
    "/v1/incidents",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Report an incident.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyHousekeeping,
  );

  app.all(
    "/v1/incidents/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy incident requests to the housekeeping service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyHousekeeping,
  );

  /**
   * Lost & found — housekeeping-service owns the full lifecycle (register,
   * update, claim, return). These were previously registered in
   * operations-routes.ts against core-service, which only ever implemented the
   * two reads, so every write 404ed downstream and the working implementation
   * was unreachable through the gateway. See ui-gaps/07-lost-and-found.md.
   */
  app.get(
    "/v1/lost-and-found",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "List lost and found items.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyHousekeeping,
  );

  // Registering an item POSTs to the bare path, which `/v1/lost-and-found/*`
  // does not match — the same trap as incident and police-report filing.
  app.post(
    "/v1/lost-and-found",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Register a lost and found item.",
        body: jsonObjectSchema,
        response: { 201: jsonObjectSchema },
      }),
    },
    proxyHousekeeping,
  );

  app.all(
    "/v1/lost-and-found/*",
    {
      preHandler: tenantScopeFromQueryOrBody,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy lost and found operations to the housekeeping service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyHousekeeping,
  );

  // Maintenance routes - proxy to housekeeping service
  app.all(
    "/v1/maintenance/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy maintenance requests to the housekeeping service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyHousekeeping,
  );
};
