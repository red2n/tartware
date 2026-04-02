import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import fp from "fastify-plugin";

import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { getUserMemberships, type TenantMembership } from "../services/membership-service.js";

const ROLE_PRIORITY: Record<TenantMembership["role"], number> = {
  OWNER: 500,
  ADMIN: 400,
  MANAGER: 300,
  STAFF: 200,
  VIEWER: 100,
};

type AuthContext = {
  userId: string | null;
  isAuthenticated: boolean;
  memberships: TenantMembership[];
  membershipMap: Map<string, TenantMembership>;
  ensureMembershipsLoaded: () => Promise<void>;
  hasRole: (tenantId: string, role: TenantMembership["role"]) => boolean;
  getMembership: (tenantId: string) => TenantMembership | undefined;
  authorizedTenantIds: Set<string>;
};

const createAuthContext = (
  userId: string | null,
  memberships: TenantMembership[],
  membershipLoader?: () => Promise<TenantMembership[]>,
): AuthContext => {
  let loadPromise: Promise<void> | null = null;
  let membershipsLoaded = membershipLoader === undefined;

  const context: AuthContext = {
    userId,
    isAuthenticated: Boolean(userId),
    memberships,
    membershipMap: new Map(memberships.map((membership) => [membership.tenantId, membership])),
    ensureMembershipsLoaded: async () => {
      if (membershipsLoaded || !membershipLoader || loadPromise) {
        await loadPromise;
        return;
      }

      loadPromise = (async () => {
        const loadedMemberships = await membershipLoader();
        context.memberships = loadedMemberships;
        context.membershipMap = new Map(
          loadedMemberships.map((membership) => [membership.tenantId, membership]),
        );
        membershipsLoaded = true;
      })();

      try {
        await loadPromise;
      } finally {
        loadPromise = null;
      }
    },
    hasRole: (tenantId: string, requiredRole: TenantMembership["role"]): boolean => {
      const membership = context.membershipMap.get(tenantId);
      if (!membership) {
        return false;
      }
      return (ROLE_PRIORITY[membership.role] ?? 0) >= (ROLE_PRIORITY[requiredRole] ?? 0);
    },
    getMembership: (tenantId: string) => context.membershipMap.get(tenantId),
    authorizedTenantIds: new Set<string>(),
  };

  return context;
};

const loadMembershipsForRequest = async (
  request: FastifyRequest,
  userId: string,
): Promise<TenantMembership[]> => {
  try {
    return await getUserMemberships(userId);
  } catch (error) {
    request.log.error(error, "failed to load tenant memberships");
    return [];
  }
};

export const ensureAuthMembershipsLoaded = async (request: FastifyRequest): Promise<void> => {
  await request.auth.ensureMembershipsLoaded();
};

const buildTenantScopeGuard = (options: TenantScopeOptions = {}): preHandlerHookHandler => {
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

    await ensureAuthMembershipsLoaded(request);

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
      const missing = modules.filter((moduleId) => !enabledModules.has(moduleId));
      if (missing.length > 0) {
        reply.forbidden("TENANT_MODULE_NOT_ENABLED");
        return reply;
      }
    }

    request.auth.authorizedTenantIds.add(tenantId);
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

type TenantScopeDecorator = (options?: TenantScopeOptions) => preHandlerHookHandler;

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }

  interface FastifyInstance {
    withTenantScope: TenantScopeDecorator;
  }
}

const authContextPlugin = fp(async (fastify: FastifyInstance) => {
  const authContextKey = Symbol("authContext");

  fastify.decorateRequest<AuthContext>("auth", {
    getter() {
      return (this as unknown as Record<symbol, AuthContext>)[authContextKey];
    },
    setter(value: AuthContext) {
      (this as unknown as Record<symbol, AuthContext>)[authContextKey] = value;
    },
  });

  const tenantScopeDecorator: TenantScopeDecorator = (options?: TenantScopeOptions) =>
    buildTenantScopeGuard(options);

  fastify.decorate("withTenantScope", tenantScopeDecorator);

  fastify.addHook("onRequest", async (request) => {
    request.auth = createAuthContext(null, []);

    if (request.routeOptions?.config?.authContextPublic === true) {
      return;
    }

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return;
    }

    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      return;
    }

    request.auth = createAuthContext(payload.sub, [], () =>
      loadMembershipsForRequest(request, payload.sub),
    );
  });
});

export default authContextPlugin;
