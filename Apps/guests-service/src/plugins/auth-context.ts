import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import fp from "fastify-plugin";

import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import type { TenantMembership } from "../services/membership-service.js";
import { getUserMemberships } from "../services/membership-service.js";

const ROLE_PRIORITY: Record<TenantMembership["role"], number> = {
  OWNER: 500,
  ADMIN: 400,
  MANAGER: 300,
  STAFF: 200,
  VIEWER: 100,
};

export type AuthContext = {
  userId: string | null;
  isAuthenticated: boolean;
  memberships: TenantMembership[];
  membershipMap: Map<string, TenantMembership>;
  hasRole: (tenantId: string, role: TenantMembership["role"]) => boolean;
  getMembership: (tenantId: string) => TenantMembership | undefined;
  authorizedTenantIds: Set<string>;
};

const createAuthContext = (
  userId: string | null,
  memberships: TenantMembership[],
): AuthContext => {
  const membershipMap = new Map(
    memberships.map((membership) => [membership.tenantId, membership]),
  );

  const hasRole = (
    tenantId: string,
    requiredRole: TenantMembership["role"],
  ): boolean => {
    const membership = membershipMap.get(tenantId);
    if (!membership) {
      return false;
    }
    return (
      (ROLE_PRIORITY[membership.role] ?? 0) >=
      (ROLE_PRIORITY[requiredRole] ?? 0)
    );
  };

  return {
    userId,
    isAuthenticated: Boolean(userId),
    memberships,
    membershipMap,
    hasRole,
    getMembership: (tenantId: string) => membershipMap.get(tenantId),
    authorizedTenantIds: new Set<string>(),
  };
};

type TenantScopeOptions = {
  minRole?: TenantMembership["role"];
  resolveTenantId?: (request: FastifyRequest) => string | undefined;
  allowMissingTenantId?: boolean;
  allowUnauthenticated?: boolean;
  requireActiveMembership?: boolean;
  requiredModules?: string | string[];
};

export type TenantScopeDecorator = (
  options?: TenantScopeOptions,
) => preHandlerHookHandler;

const buildTenantScopeGuard = (
  options: TenantScopeOptions = {},
): preHandlerHookHandler => {
  const {
    minRole = "STAFF",
    resolveTenantId,
    allowMissingTenantId = false,
    allowUnauthenticated = false,
    requireActiveMembership = true,
    requiredModules,
  } = options;

  const resolver = resolveTenantId ?? (() => undefined);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!allowUnauthenticated && !request.auth.isAuthenticated) {
      reply.unauthorized("AUTHENTICATION_REQUIRED");
      return reply;
    }

    const tenantId = resolver(request) ?? undefined;

    if (!tenantId) {
      if (allowMissingTenantId) {
        return;
      }
      reply.badRequest("TENANT_ID_REQUIRED");
      return reply;
    }

    const membership = request.auth.getMembership(tenantId);
    if (!membership) {
      reply.forbidden("TENANT_ACCESS_DENIED");
      return reply;
    }

    if (requireActiveMembership && !membership.isActive) {
      reply.forbidden("TENANT_ACCESS_INACTIVE");
      return reply;
    }

    if (!request.auth.hasRole(tenantId, minRole)) {
      reply.forbidden("TENANT_ROLE_INSUFFICIENT");
      return reply;
    }

    const modules = Array.isArray(requiredModules)
      ? requiredModules
      : requiredModules
        ? [requiredModules]
        : [];

    if (modules.length > 0) {
      const enabledModules = new Set(membership.modules);
      const missing = modules.filter(
        (moduleId) => !enabledModules.has(moduleId),
      );
      if (missing.length > 0) {
        reply.forbidden("TENANT_MODULE_NOT_ENABLED");
        return reply;
      }
    }

    request.auth.authorizedTenantIds.add(tenantId);
  };
};

const authContextPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorateRequest("auth", null);

  const tenantScopeDecorator: TenantScopeDecorator = (
    options?: TenantScopeOptions,
  ) => buildTenantScopeGuard(options);

  fastify.decorate("withTenantScope", tenantScopeDecorator);

  fastify.addHook("onRequest", async (request) => {
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      request.auth = createAuthContext(null, []);
      return;
    }

    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      request.auth = createAuthContext(null, []);
      return;
    }

    try {
      const memberships = await getUserMemberships(payload.sub);
      request.auth = createAuthContext(payload.sub, memberships);
    } catch (error) {
      request.log.error(error, "failed to load tenant memberships");
      request.auth = createAuthContext(payload.sub, []);
    }
  });
});

export default authContextPlugin;
