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
import {
  CORE_PROXY_TAG,
  HOUSEKEEPING_COMMAND_TAG,
  reservationParamsSchema,
  tenantTaskParamsSchema,
} from "./schemas.js";

export const registerHousekeepingRoutes = (app: FastifyInstance): void => {
  const proxyHousekeeping = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.housekeepingServiceUrl);

  const tenantScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "STAFF",
    requiredModules: "core",
  });

  app.get(
    "/v1/housekeeping/tasks",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy housekeeping task queries to the housekeeping service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyHousekeeping,
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks/:taskId/assign",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Assign a housekeeping task via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    forwardHousekeepingAssignCommand,
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks/:taskId/complete",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Complete a housekeeping task via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
        },
      }),
    },
    forwardHousekeepingCompleteCommand,
  );

  app.post(
    "/v1/tenants/:tenantId/housekeeping/tasks",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Create a housekeeping task via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
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
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Reassign a housekeeping task via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
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
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Reopen a housekeeping task via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
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
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Add a housekeeping task note via the Command Center.",
        params: tenantTaskParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
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
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: HOUSEKEEPING_COMMAND_TAG,
        summary: "Bulk update housekeeping tasks via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: jsonObjectSchema,
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
  app.all(
    "/v1/incidents",
    {
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

  app.all(
    "/v1/incidents/*",
    {
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

  // Maintenance routes - proxy to housekeeping service
  app.all(
    "/v1/maintenance/*",
    {
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
