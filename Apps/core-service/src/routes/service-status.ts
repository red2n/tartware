/**
 * Service-status routes.
 *
 * Provides an authenticated endpoint that aggregates service status
 * from the service-registry, giving administrators a view of all
 * running Tartware services. Communication to the registry is internal
 * (service-to-service), never exposed directly to end users.
 *
 * @module service-status
 */
import type { FastifyInstance } from "fastify";

const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://localhost:3075";
const FETCH_TIMEOUT_MS = 5_000;

/** Register service-status routes on the core-service. */
export const registerServiceStatusRoutes = (app: FastifyInstance): void => {
  const adminOnly = app.withTenantScope({
    allowMissingTenantId: true,
    minRole: "ADMIN",
  });

  app.get("/v1/services/status", {
    preHandler: adminOnly,
    schema: {
      tags: ["System"],
      summary: "Aggregated service status from service-registry",
      description:
        "Fetches the current service registry state and returns a summary of all registered services, their instances, and health status.",
    },
    handler: async (_request, reply) => {
      try {
        const response = await fetch(`${REGISTRY_URL}/v1/registry/services`, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        if (!response.ok) {
          app.log.error(
            { status: response.status },
            "Failed to fetch service status from registry",
          );
          return reply.badGateway("Could not retrieve service status from the registry");
        }

        const data = await response.json();
        return reply.send(data);
      } catch (err) {
        app.log.error({ err }, "Service registry unreachable");
        return reply.serviceUnavailable("Service registry is not reachable");
      }
    },
  });
};
