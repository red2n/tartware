import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyPlugin from "fastify-plugin";
import jwt from "jsonwebtoken";

import { config } from "../config.js";

interface JwtPayload {
  sub: string;
  tenantId?: string;
  propertyId?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

interface AuthContext {
  userId: string;
  tenantId: string;
  propertyId?: string;
  role?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}

async function authContextPluginFn(app: FastifyInstance) {
  app.decorateRequest("authContext", undefined as AuthContext | undefined);

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url.startsWith("/health") || request.url.startsWith("/metrics")) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing authorization header" });
    }

    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, config.auth.jwt.secret, {
        issuer: config.auth.jwt.issuer,
        audience: config.auth.jwt.audience,
      }) as JwtPayload;

      const tenantIdHeader = request.headers["x-tenant-id"];
      const tenantId =
        (Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader) || decoded.tenantId;

      if (!tenantId) {
        return reply.status(400).send({ error: "Missing x-tenant-id header" });
      }

      request.authContext = {
        userId: decoded.sub,
        tenantId,
        propertyId: decoded.propertyId,
        role: decoded.role,
      };
    } catch {
      return reply.status(401).send({ error: "Invalid token" });
    }
  });
}

export default fastifyPlugin(authContextPluginFn, {
  name: "auth-context",
  fastify: "5.x",
});
