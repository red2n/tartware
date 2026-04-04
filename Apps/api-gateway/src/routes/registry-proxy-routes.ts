/**
 * Service registry proxy routes.
 *
 * Proxies read-only service discovery and status endpoints to the
 * service-registry. Only authenticated users with at least ADMIN role
 * can view registered services — internal registration/heartbeat/deregister
 * traffic flows directly between services and the registry.
 *
 * @module registry-proxy-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { REGISTRY_PROXY_TAG } from "./schemas.js";

/** Register service-registry proxy routes on the gateway. */
export const registerRegistryProxyRoutes = (app: FastifyInstance): void => {
  const proxyRegistry = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  const adminOnly = app.withTenantScope({
    allowMissingTenantId: true,
    minRole: "ADMIN",
  });

  app.get("/v1/registry/services", {
    preHandler: adminOnly,
    schema: buildRouteSchema({
      tag: REGISTRY_PROXY_TAG,
      summary: "List all registered services",
      description:
        "Returns every service instance currently registered with the service registry, including status and last heartbeat.",
      response: {
        200: jsonObjectSchema,
      },
    }),
    handler: proxyRegistry,
  });

  app.get("/v1/registry/services/:name", {
    preHandler: adminOnly,
    schema: buildRouteSchema({
      tag: REGISTRY_PROXY_TAG,
      summary: "Get instances of a specific service",
      description: "Returns all instances of the named service from the registry.",
      response: {
        200: jsonObjectSchema,
      },
    }),
    handler: proxyRegistry,
  });
};
