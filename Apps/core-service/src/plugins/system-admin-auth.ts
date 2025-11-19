import type { SystemAdminRole } from "@tartware/schemas";
import type { FastifyPluginAsync, FastifyReply, preHandlerHookHandler } from "fastify";
import fp from "fastify-plugin";

import { extractBearerToken, verifySystemAdminToken } from "../lib/jwt.js";
import type {
  SystemAdminContext,
  SystemAdminScopeDecorator,
  SystemAdminScopeOptions,
} from "../types/system-admin.js";

const ROLE_PRIORITY: Record<SystemAdminRole, number> = {
  SYSTEM_ADMIN: 400,
  SYSTEM_SUPPORT: 300,
  SYSTEM_OPERATOR: 200,
  SYSTEM_AUDITOR: 100,
};

const hasRequiredRole = (current: SystemAdminRole, minimum: SystemAdminRole): boolean => {
  const currentScore = ROLE_PRIORITY[current] ?? 0;
  const requiredScore = ROLE_PRIORITY[minimum] ?? 0;
  return currentScore >= requiredScore;
};

const unauthorized = (reply: FastifyReply) =>
  reply.status(401).send({
    error: "SYSTEM_ADMIN_AUTH_REQUIRED",
    message: "Valid system admin credentials required.",
  });

const forbidden = (reply: FastifyReply) =>
  reply.status(403).send({
    error: "SYSTEM_ADMIN_ROLE_INSUFFICIENT",
    message: "System admin role is insufficient.",
  });

const buildGuard =
  (options: SystemAdminScopeOptions = {}): preHandlerHookHandler =>
  async (request, reply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return unauthorized(reply);
    }

    const payload = verifySystemAdminToken(token);
    if (!payload || payload.scope !== "SYSTEM_ADMIN") {
      return unauthorized(reply);
    }

    const context: SystemAdminContext = {
      adminId: payload.sub,
      username: payload.username,
      role: payload.role,
      sessionId: payload.session_id,
      scope: "SYSTEM_ADMIN",
    };

    request.systemAdmin = context;

    const minimumRole = options.minRole ?? "SYSTEM_SUPPORT";
    if (!hasRequiredRole(context.role, minimumRole)) {
      return forbidden(reply);
    }
  };

const systemAdminAuthPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("systemAdmin", null);

  const decorator: SystemAdminScopeDecorator = (options?: SystemAdminScopeOptions) =>
    buildGuard(options);

  fastify.decorate("withSystemAdminScope", decorator);
};

declare module "fastify" {
  interface FastifyInstance {
    withSystemAdminScope: SystemAdminScopeDecorator;
  }

  interface FastifyRequest {
    systemAdmin: SystemAdminContext | null;
  }
}

export default fp(systemAdminAuthPlugin, {
  name: "system-admin-auth",
});
