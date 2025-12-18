import { TenantRoleEnum } from "@tartware/schemas";
import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import fp from "fastify-plugin";

import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { type CachedMembership, userCacheService } from "../services/user-cache-service.js";
import type {
  AuthContext,
  RolePriorityMap,
  TenantMembership,
  TenantScopeDecorator,
  TenantScopeOptions,
} from "../types/auth.js";

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
    const currentPriority = ROLE_PRIORITY[membership.role] ?? 0;
    const requiredPriority = ROLE_PRIORITY[minimumRole] ?? 0;
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

const toTenantMembership = (membership: CachedMembership): TenantMembership => ({
  tenantId: membership.tenant_id,
  tenantName: membership.tenant_name,
  role: TenantRoleEnum.parse(membership.role),
  isActive: membership.is_active,
  permissions: membership.permissions ?? {},
  modules: membership.modules,
});

const buildTenantScopeGuard = (options: TenantScopeOptions = {}): preHandlerHookHandler => {
  const {
    minRole = "STAFF",
    resolveTenantId,
    allowMissingTenantId = false,
    allowUnauthenticated = false,
    requireActiveMembership = true,
    requireAnyTenantWithRole,
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
      if (requireAnyTenantWithRole) {
        const hasRequiredRole = request.auth.memberships.some((membership: TenantMembership) => {
          if (requireActiveMembership && !membership.isActive) {
            return false;
          }
          const currentPriority = ROLE_PRIORITY[membership.role] ?? 0;
          const requiredPriority = ROLE_PRIORITY[requireAnyTenantWithRole] ?? 0;
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
      request.log.warn(
        { tenantId, userId: request.auth.userId },
        "tenant access denied: membership missing",
      );
      reply.forbidden("TENANT_ACCESS_DENIED");
      return reply;
    }

    if (requireActiveMembership && !membership.isActive) {
      request.log.warn(
        { tenantId, userId: request.auth.userId },
        "tenant access denied: membership inactive",
      );
      reply.forbidden("TENANT_ACCESS_INACTIVE");
      return reply;
    }

    if (!request.auth.hasRole(tenantId, minRole)) {
      request.log.warn(
        { tenantId, userId: request.auth.userId, minRole, role: membership.role },
        "tenant access denied: role insufficient",
      );
      reply.forbidden("TENANT_ROLE_INSUFFICIENT");
      return reply;
    }

    const moduleRequirements = Array.isArray(requiredModules)
      ? requiredModules
      : requiredModules
        ? [requiredModules]
        : [];

    if (moduleRequirements.length > 0) {
      const enabledModules = new Set(membership.modules);
      const missing = moduleRequirements.filter((moduleId) => !enabledModules.has(moduleId));
      if (missing.length > 0) {
        request.log.warn(
          {
            tenantId,
            userId: request.auth.userId,
            missingModules: missing,
            enabledModules: membership.modules,
          },
          "tenant access denied: required modules missing",
        );
        reply.forbidden("TENANT_MODULE_NOT_ENABLED");
        return reply;
      }
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

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      request.auth = createAuthContext(null, []);
      return;
    }

    const payload = verifyAccessToken(token);
    if (!payload || !payload.sub) {
      request.auth = createAuthContext(null, []);
      return;
    }

    try {
      const cachedMemberships = await userCacheService.getUserMemberships(payload.sub);
      const memberships = cachedMemberships.map(toTenantMembership);
      request.auth = createAuthContext(payload.sub, memberships);
    } catch (error) {
      request.log.error(error, "Failed to load tenant memberships for authenticated user");
      request.auth = createAuthContext(payload.sub, []);
    }
  });
};

export default fp(authContextPlugin, {
  name: "auth-context",
});
