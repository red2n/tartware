import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import fp from "fastify-plugin";

import { getActiveUserTenantMemberships } from "../services/user-tenant-association-service.js";
import type {
  AuthContext,
  RolePriorityMap,
  TenantMembership,
  TenantScopeDecorator,
  TenantScopeOptions,
} from "../types/auth.js";

export const AUTH_USER_ID_HEADER = "x-user-id";

const ROLE_PRIORITY: RolePriorityMap = {
  OWNER: 500,
  ADMIN: 400,
  MANAGER: 300,
  STAFF: 200,
  VIEWER: 100,
};

const createAuthContext = (userId: string | null, memberships: TenantMembership[]): AuthContext => {
  const membershipMap = new Map(memberships.map((item) => [item.tenantId, item]));

  const hasRole = (tenantId: string, minimumRole: TenantMembership["role"]): boolean => {
    const membership = membershipMap.get(tenantId);
    if (!membership) {
      return false;
    }
    const currentPriority = ROLE_PRIORITY[membership.role];
    const requiredPriority = ROLE_PRIORITY[minimumRole];
    return currentPriority >= requiredPriority;
  };

  const getMembership = (tenantId: string): TenantMembership | undefined =>
    membershipMap.get(tenantId);

  return {
    userId,
    isAuthenticated: Boolean(userId),
    memberships,
    membershipMap,
    authorizedTenantIds: new Set<string>(),
    getMembership,
    hasRole,
  };
};

const buildTenantScopeGuard = (options: TenantScopeOptions = {}): preHandlerHookHandler => {
  const {
    minRole = "STAFF",
    resolveTenantId,
    allowMissingTenantId = false,
    allowUnauthenticated = false,
    requireActiveMembership = true,
    requireAnyTenantWithRole,
  } = options;

  const resolver = resolveTenantId ?? (() => undefined);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!allowUnauthenticated && !request.auth.isAuthenticated) {
      reply.unauthorized("AUTHENTICATION_REQUIRED");
      return reply;
    }

    const tenantId = resolver(request) ?? undefined;

    if (!tenantId) {
      if (requireAnyTenantWithRole) {
        const hasRequiredRole = request.auth.memberships.some((membership: TenantMembership) => {
          if (requireActiveMembership && !membership.isActive) {
            return false;
          }
          const currentPriority = ROLE_PRIORITY[membership.role];
          const requiredPriority = ROLE_PRIORITY[requireAnyTenantWithRole];
          return currentPriority >= requiredPriority;
        });
        if (!hasRequiredRole) {
          reply.forbidden("TENANT_ROLE_INSUFFICIENT");
          return reply;
        }
      }

      if (allowMissingTenantId) {
        return;
      }
      reply.badRequest("TENANT_ID_REQUIRED");
      return reply;
    }

    // Validate UUID format before checking access
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      reply.badRequest("INVALID_TENANT_ID_FORMAT");
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

    request.auth.authorizedTenantIds.add(tenantId);
  };
};

const authContextPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("auth", null);

  const tenantScopeDecorator: TenantScopeDecorator = (decoratorOptions?: TenantScopeOptions) =>
    buildTenantScopeGuard(decoratorOptions);

  fastify.decorate("withTenantScope", tenantScopeDecorator);

  fastify.addHook("onRequest", async (request) => {
    // Skip auth for health endpoint
    if (request.url === "/health") {
      request.auth = createAuthContext(null, []);
      return;
    }

    const userIdHeader = request.headers[AUTH_USER_ID_HEADER];
    if (typeof userIdHeader !== "string" || userIdHeader.trim().length === 0) {
      request.auth = createAuthContext(null, []);
      return;
    }

    const userId = userIdHeader.trim();
    const memberships = await getActiveUserTenantMemberships(userId);
    request.auth = createAuthContext(userId, memberships);
  });
};

export default fp(authContextPlugin, {
  name: "auth-context",
});
