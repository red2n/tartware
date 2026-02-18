import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
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

const normalizePublicKey = (key: string) => key.replace(/\\n/g, "\n").trim();

export const authPlugin = fp(async (app) => {
  if (process.env.DISABLE_AUTH === "true") {
    app.log.warn("Auth disabled via DISABLE_AUTH");
    app.decorate("authenticate", async () => undefined);
    return;
  }

  await app.register(fastifyJwt, {
    secret: {
      public: normalizePublicKey(config.auth.publicKey),
    },
    verify: {
      algorithms: ["RS256"],
      allowedAud: config.auth.audience,
      allowedIss: config.auth.issuer,
    },
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await request.jwtVerify<AuthUser>();
      if (!payload.sub) {
        request.log.warn("Missing subject claim in JWT");
        return reply.unauthorized("Unauthorized");
      }
      if (!payload.tenantId || !isValidUuid(payload.tenantId)) {
        request.log.warn("Missing tenantId claim in JWT");
        return reply.forbidden("Tenant context required");
      }
      const membership = await getUserTenantMembership(payload.sub, payload.tenantId);
      if (!membership) {
        request.log.warn(
          { tenantId: payload.tenantId, userId: payload.sub },
          "Tenant membership missing",
        );
        return reply.forbidden("Tenant access denied");
      }
      if (!membership.isActive) {
        request.log.warn(
          { tenantId: payload.tenantId, userId: payload.sub },
          "Tenant membership inactive",
        );
        return reply.forbidden("Tenant access inactive");
      }
      request.authUser = payload;
      request.tenantMembership = membership;
    } catch (error) {
      request.log.warn({ err: error }, "Authentication failed");
      return reply.unauthorized("Unauthorized");
    }
  });
});
