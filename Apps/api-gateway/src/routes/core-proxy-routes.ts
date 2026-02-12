import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { CORE_PROXY_TAG, reservationParamsSchema } from "./schemas.js";

export const registerCoreProxyRoutes = (app: FastifyInstance): void => {
  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  const tenantScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "STAFF",
    requiredModules: "core",
  });

  app.get(
    "/v1/tenants",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "List tenants accessible to the authenticated user.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  // Properties routes - proxy to core service
  app.get(
    "/v1/properties",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "List properties for a tenant.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  app.post(
    "/v1/properties",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Create a new property.",
        body: jsonObjectSchema,
        response: {
          201: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/properties/*",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy property operations to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  // Dashboard routes - proxy to core service
  app.all(
    "/v1/dashboard/*",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy dashboard requests to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  // Modules routes - proxy to core service
  app.get(
    "/v1/modules/catalog",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "List available platform modules.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/tenants/:tenantId/modules",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "List modules enabled for a tenant.",
        params: reservationParamsSchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  // Reports routes - proxy to core service
  app.all(
    "/v1/reports/*",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy report requests to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  // Auth routes
  app.all(
    "/v1/auth",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy auth calls to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/auth/*",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy auth calls to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  // User management routes - proxy to core service
  app.all(
    "/v1/users",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy user management calls to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/users/*",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy user management calls to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  // User-tenant association routes - proxy to core service
  app.all(
    "/v1/user-tenant-associations",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy user-tenant association calls to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  app.all(
    "/v1/user-tenant-associations/*",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy user-tenant association calls to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );

  // System routes
  app.all(
    "/v1/system/*",
    {
      schema: buildRouteSchema({
        tag: CORE_PROXY_TAG,
        summary: "Proxy system admin calls to core service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyCore,
  );
};
