import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { config } from "../config.js";
import { getUserTenantMembership, type TenantMembership } from "../services/membership-service.js";
import type { AuthUser } from "../types/auth.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser?: AuthUser;
    tenantMembership?: TenantMembership;
  }
}

const isValidUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const getTenantIdFromQuery = (query: FastifyRequest["query"]): string | undefined => {
  if (!query || typeof query !== "object") {
    return undefined;
  }

  const candidate = (query as Record<string, unknown>).tenant_id;
  return typeof candidate === "string" ? candidate : undefined;
};

export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(fastifyJwt, {
    secret: config.auth.jwt.secret,
    verify: {
      algorithms: ["HS256"],
      allowedIss: config.auth.jwt.issuer,
      allowedAud: config.auth.jwt.audience,
    },
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<AuthUser>();
      if (!payload.sub) {
        request.log.warn("Missing subject claim in JWT");
        return reply.unauthorized("Unauthorized");
      }

      // Resolve tenantId from JWT claims or query parameter
      const tenantId =
        (payload.tenantId && isValidUuid(payload.tenantId) ? payload.tenantId : undefined) ??
        getTenantIdFromQuery(request.query);

      if (!tenantId || !isValidUuid(tenantId)) {
        request.log.debug("No valid tenant context — skipping authUser assignment");
        return;
      }

      const membership = await getUserTenantMembership(payload.sub, tenantId);
      if (!membership) {
        request.log.warn({ tenantId, userId: payload.sub }, "Tenant membership missing");
        return reply.forbidden("Tenant access denied");
      }
      if (!membership.isActive) {
        request.log.warn({ tenantId, userId: payload.sub }, "Tenant membership inactive");
        return reply.forbidden("Tenant access inactive");
      }

      // Derive scopes from membership role for hosted settings endpoints.
      const scopes: string[] = ["settings:read"];
      if (["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        scopes.push("settings:write");
      }

      request.authUser = { ...payload, tenantId, scope: scopes };
      request.tenantMembership = membership;
    } catch (error) {
      request.log.warn({ err: error }, "Authentication failed");
      return reply.unauthorized("Unauthorized");
    }
  });
});
