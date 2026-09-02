/**
 * Document service proxy routes.
 *
 * Forwards `/v1/documents/*` to the document service, which renders a typed
 * payload plus a template id into PDF or HTML.
 *
 * `POST /v1/documents/render` is proxied directly rather than dispatched
 * through the Command Center: it changes nothing. It is a read that happens to
 * carry its input in a body, and routing it through the outbox would make a
 * front desk wait on Kafka to print a folio.
 *
 * @module document-routes
 */
import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

const DOCUMENT_PROXY_TAG = "Documents (proxy)";

/** Register document service proxy routes on the gateway. */
export const registerDocumentRoutes = (app: FastifyInstance): void => {
  const proxyDocuments = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.documentServiceUrl);

  // The renderer holds no tenant data — the payload comes from the caller — so
  // the gate here is authentication, not tenant scope.
  const authenticatedOnly = app.withTenantScope({
    allowMissingTenantId: true,
    minRole: "VIEWER",
  });

  app.all(
    "/v1/documents/*",
    {
      preHandler: authenticatedOnly,
      schema: buildRouteSchema({
        tag: DOCUMENT_PROXY_TAG,
        summary: "Proxy document rendering requests.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyDocuments,
  );
};
