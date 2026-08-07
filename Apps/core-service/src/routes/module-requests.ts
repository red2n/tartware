import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import {
  CreateModuleRequestSchema,
  ModuleRequestStatusSchema,
  ReviewModuleRequestSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import {
  createModuleRequest,
  listModuleRequests,
  listMyModuleRequests,
  ModuleAlreadyEnabledError,
  ModuleRequestNotPendingError,
  reviewModuleRequest,
} from "../services/module-request-service.js";

const MODULE_REQUESTS_TAG = "Modules";

type TenantParams = { tenantId: string };
type RequestParams = { tenantId: string; requestId: string };

const tenantIdParamSchema = {
  type: "object",
  properties: { tenantId: { type: "string", format: "uuid" } },
  required: ["tenantId"],
} as const;

const requestIdParamSchema = {
  type: "object",
  properties: {
    tenantId: { type: "string", format: "uuid" },
    requestId: { type: "string", format: "uuid" },
  },
  required: ["tenantId", "requestId"],
} as const;

/**
 * Requests from staff to have a locked module switched on.
 *
 * Raising one is deliberately open to any member of the tenant: the caller is
 * by definition blocked by the module they are asking for, so gating this on
 * that module — or on the Modules screen they cannot open — would make the
 * whole flow unreachable. Reviewing is ADMIN, matching the module toggle.
 */
export const registerModuleRequestRoutes = (app: FastifyInstance): void => {
  const memberScope = app.withTenantScope({
    resolveTenantId: (request) => (request.params as TenantParams).tenantId,
    minRole: "VIEWER",
  });

  const adminScope = app.withTenantScope({
    resolveTenantId: (request) => (request.params as TenantParams).tenantId,
    minRole: "ADMIN",
  });

  app.post<{ Params: TenantParams; Body: unknown }>(
    "/v1/tenants/:tenantId/module-requests",
    {
      preHandler: memberScope,
      schema: buildRouteSchema({
        tag: MODULE_REQUESTS_TAG,
        summary: "Ask an administrator to switch a module on",
        params: tenantIdParamSchema,
        body: {
          type: "object",
          properties: {
            moduleId: { type: "string" },
            requestedScreen: { type: "string" },
            propertyId: { type: "string", format: "uuid" },
            reason: { type: "string" },
          },
          required: ["moduleId"],
        },
        response: { 201: jsonObjectSchema },
      }),
    },
    async (request, reply) => {
      const parsed = CreateModuleRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.issues[0]?.message ?? "Invalid module request");
      }
      if (!request.auth.userId) {
        return reply.unauthorized("You must be logged in to raise a request.");
      }

      try {
        const created = await createModuleRequest({
          tenantId: request.params.tenantId,
          userId: request.auth.userId,
          moduleId: parsed.data.moduleId,
          propertyId: parsed.data.propertyId,
          requestedScreen: parsed.data.requestedScreen,
          reason: parsed.data.reason,
        });
        reply.code(201);
        return created;
      } catch (error) {
        if (error instanceof ModuleAlreadyEnabledError) {
          return reply.conflict(error.message);
        }
        throw error;
      }
    },
  );

  app.get<{ Params: TenantParams; Querystring: { status?: string } }>(
    "/v1/tenants/:tenantId/module-requests",
    {
      preHandler: adminScope,
      schema: buildRouteSchema({
        tag: MODULE_REQUESTS_TAG,
        summary: "List module requests awaiting review",
        params: tenantIdParamSchema,
        querystring: {
          type: "object",
          properties: { status: { type: "string" } },
        },
        response: { 200: jsonObjectSchema },
      }),
    },
    async (request, reply) => {
      const status = request.query.status
        ? ModuleRequestStatusSchema.safeParse(request.query.status)
        : null;
      if (status && !status.success) {
        return reply.badRequest("Unknown request status");
      }
      return { requests: await listModuleRequests(request.params.tenantId, status?.data) };
    },
  );

  app.get<{ Params: TenantParams }>(
    "/v1/tenants/:tenantId/module-requests/mine",
    {
      preHandler: memberScope,
      schema: buildRouteSchema({
        tag: MODULE_REQUESTS_TAG,
        summary: "List the module requests the caller has raised",
        params: tenantIdParamSchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    async (request, reply) => {
      if (!request.auth.userId) {
        return reply.unauthorized("You must be logged in to view your requests.");
      }
      return {
        requests: await listMyModuleRequests(request.params.tenantId, request.auth.userId),
      };
    },
  );

  for (const decision of ["approved", "rejected"] as const) {
    const verb = decision === "approved" ? "approve" : "reject";

    app.post<{ Params: RequestParams; Body: unknown }>(
      `/v1/tenants/:tenantId/module-requests/:requestId/${verb}`,
      {
        preHandler: adminScope,
        schema: buildRouteSchema({
          tag: MODULE_REQUESTS_TAG,
          summary:
            decision === "approved"
              ? "Approve a module request and switch the module on"
              : "Reject a module request",
          params: requestIdParamSchema,
          // Nullable: the notes are optional, so approving with no body at all
          // is a legitimate call and must not come back as "body must be object".
          body: {
            type: ["object", "null"],
            properties: { notes: { type: "string" } },
          },
          response: { 200: jsonObjectSchema },
        }),
      },
      async (request, reply) => {
        const parsed = ReviewModuleRequestSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return reply.badRequest(parsed.error.issues[0]?.message ?? "Invalid review");
        }
        if (!request.auth.userId) {
          return reply.unauthorized("You must be logged in to review a request.");
        }

        try {
          return await reviewModuleRequest({
            tenantId: request.params.tenantId,
            requestId: request.params.requestId,
            reviewerId: request.auth.userId,
            decision,
            notes: parsed.data.notes,
          });
        } catch (error) {
          // Already decided, or never this tenant's — the caller's queue is stale.
          if (error instanceof ModuleRequestNotPendingError) {
            return reply.conflict(error.message);
          }
          throw error;
        }
      },
    );
  }
};
