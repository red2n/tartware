/**
 * Auth Context Plugin — Identity extraction and tenant-scoped authorization.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │ @fastify/rate-limit (server.ts) — global rate limit on ALL routes  │
 *   │   └─► onRequest: identityExtractor — extracts JWT identity        │
 *   │         └─► preHandler: withTenantScope() — enforces authz        │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * The onRequest hook only performs identity extraction (who is calling?).
 * It never rejects requests — unauthenticated callers get an anonymous
 * context. Authorization (can this caller do this?) happens exclusively
 * in the withTenantScope preHandler, which routes opt into.
 *
 * Rate limiting is applied globally via @fastify/rate-limit registered
 * before this plugin in server.ts. Auth routes additionally configure
 * per-route stricter limits via route config.rateLimit overrides.
 *
 * @module auth-context
 */
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import fp from "fastify-plugin";

import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { getUserMemberships, type TenantMembership } from "../services/membership-service.js";

// ─── Role hierarchy ────────────────────────────────────────────────────────────

const ROLE_PRIORITY: Record<TenantMembership["role"], number> = {
  OWNER: 500,
  ADMIN: 400,
  MANAGER: 300,
  STAFF: 200,
  VIEWER: 100,
};

// ─── Auth context type & factory ───────────────────────────────────────────────

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

const ANONYMOUS_CONTEXT = (): AuthContext => createAuthContext(null, []);

// ─── Membership loader ─────────────────────────────────────────────────────────

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

// ─── Tenant scope guard (preHandler — enforces authorization) ──────────────────

type TenantScopeOptions = {
  minRole?: TenantMembership["role"];
  resolveTenantId?: (request: FastifyRequest) => string | undefined;
  allowMissingTenantId?: boolean;
  allowUnauthenticated?: boolean;
  requireActiveMembership?: boolean;
  requiredModules?: string | string[];
};

type TenantScopeDecorator = (options?: TenantScopeOptions) => preHandlerHookHandler;

const buildTenantScopeGuard = (options: TenantScopeOptions = {}): preHandlerHookHandler => {
  const {
    minRole = "STAFF",
    resolveTenantId,
    allowMissingTenantId = false,
    allowUnauthenticated = false,
    requireActiveMembership = true,
  } = options;

  const requiredModulesList = Array.isArray(options.requiredModules)
    ? options.requiredModules
    : options.requiredModules
      ? [options.requiredModules]
      : [];

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

    if (requiredModulesList.length > 0) {
      const enabledModules = new Set(membership.modules);
      const missing = requiredModulesList.filter((moduleId) => !enabledModules.has(moduleId));
      if (missing.length > 0) {
        reply.forbidden("TENANT_MODULE_NOT_ENABLED");
        return reply;
      }
    }

    request.auth.authorizedTenantIds.add(tenantId);
  };
};

// ─── Fastify augmentation ──────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }

  interface FastifyInstance {
    withTenantScope: TenantScopeDecorator;
  }
}

// ─── Plugin registration ───────────────────────────────────────────────────────

/**
 * Fastify plugin that decorates every request with an `auth` context.
 *
 * Identity extraction (onRequest):
 *   Reads the Authorization header, verifies the JWT, and populates
 *   `request.auth` with the caller's identity. It never rejects — callers
 *   without a valid token receive an anonymous context.
 *
 * Authorization enforcement (withTenantScope preHandler):
 *   Routes that require auth call `app.withTenantScope(...)` as a preHandler.
 *   That preHandler checks authentication, tenant membership, role, and module
 *   access. This separation keeps the global hook free of authorization
 *   decisions.
 */
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

  fastify.decorate("withTenantScope", ((options?: TenantScopeOptions) =>
    buildTenantScopeGuard(options)) as TenantScopeDecorator);

  // ── Identity extraction hook ─────────────────────────────────────────────
  // This hook ONLY extracts caller identity from the JWT. It does NOT
  // perform authorization — every request is allowed through. Authorization
  // is enforced per-route via the withTenantScope preHandler.
  //
  // Rate limiting is handled globally by @fastify/rate-limit registered in
  // server.ts before this plugin (Fastify processes hooks in registration
  // order). Auth routes additionally override with stricter per-route limits.

  fastify.addHook("onRequest", async (request) => {
    request.auth = ANONYMOUS_CONTEXT();

    // Public routes (health, self-service, auth) skip token extraction entirely.
    if (request.routeOptions?.config?.authContextPublic === true) {
      return;
    }

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return;
    }

    // Decode the JWT to extract caller identity. Invalid/expired tokens
    // result in an anonymous context — the withTenantScope preHandler will
    // reject the request at the authorization layer if auth is required.
    const identity = verifyAccessToken(token);
    if (!identity?.sub) {
      return;
    }

    request.auth = createAuthContext(identity.sub, [], () =>
      loadMembershipsForRequest(request, identity.sub),
    );
  });
});

export default authContextPlugin;
