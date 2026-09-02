/**
 * DEV DOC
 * Module: plugins/auth-context.ts
 * Purpose: Verify the caller's JWT. No membership lookup, no tenant scope.
 * Ownership: document-service
 *
 * Every other service loads tenant memberships from the database to decide what
 * a caller may see. This one has no database and no tenant data: the payload it
 * renders is supplied by the caller, who already had to be authorised to hold
 * it. So the check here is authentication only — is this a caller the platform
 * issued a token to — and deliberately not authorisation, which would be
 * theatre without the data to enforce it.
 */
import { createTokenVerifier, extractBearerToken } from "@tartware/tenant-auth/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { config } from "../config.js";

/**
 * Paths served without a token.
 *
 * These are the paths `createHealthRoutes` and the metrics plugin register. A
 * Kubernetes probe and a Prometheus scrape carry no bearer token, so gating
 * them would report a healthy service as permanently unready.
 */
const PUBLIC_PATHS = new Set(["/health", "/ready", "/metrics"]);

export default fp((app: FastifyInstance, _options, done) => {
  const verify = createTokenVerifier({
    secret: config.auth.jwt.secret ?? "",
    issuer: config.auth.jwt.issuer,
    audience: config.auth.jwt.audience,
  });

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (PUBLIC_PATHS.has(request.url.split("?")[0] ?? "")) return;

    const token = extractBearerToken(request.headers.authorization);
    if (!token || !verify(token)) {
      await reply.code(401).send({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "A valid bearer token is required",
      });
    }
  });

  done();
});
