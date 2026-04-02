/**
 * Auth Context Plugin — Credential extraction and tenant-scoped authorization.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │ @fastify/rate-limit (server.ts) — global rate limit on ALL routes  │
 *   │   └─► onRequest — extracts bearer token string from header        │
 *   │         └─► preHandler: withTenantScope() — verifies JWT + authz  │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * The onRequest hook only extracts the raw bearer token from the
 * Authorization header and stores it on the request. It does NOT call
 * jwt.verify() or make any authorization decisions. Every request is
 * allowed through with an anonymous auth context.
 *
 * JWT verification and authorization enforcement happen exclusively in
 * the withTenantScope preHandler, which routes opt into. This preHandler
 * verifies the token, populates request.auth, and then checks tenant
 * membership, role hierarchy, and module access.
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

// ─── Tenant scope guard (preHandler — verifies JWT + enforces authorization) ──

type TenantScopeOptions = {
  minRole?: TenantMembership["role"];
  resolveTenantId?: (request: FastifyRequest) => string | undefined;
  allowMissingTenantId?: boolean;
  allowUnauthenticated?: boolean;
  requireActiveMembership?: boolean;
  requiredModules?: string | string[];
};

type TenantScopeDecorator = (options?: TenantScopeOptions) => preHandlerHookHandler;

/**
 * Verify the bearer token stored on the request and populate request.auth.
 * Called once per request — subsequent calls are no-ops (idempotent).
 */
const verifyRequestIdentity = (request: FastifyRequest): void => {
  if (request.auth.isAuthenticated) {
    return;
  }

  const token = (request as RequestWithToken).bearerToken;
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
};

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
    // Verify JWT and populate request.auth (idempotent — only runs once)
    verifyRequestIdentity(request);

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

/** Internal type for accessing the raw bearer token stored by onRequest. */
type RequestWithToken = FastifyRequest & { bearerToken: string | null };

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
 * Credential extraction (onRequest):
 *   Extracts the raw bearer token from the Authorization header and stores
 *   it on the request. Does NOT call jwt.verify() or make authorization
 *   decisions. Every request passes through with an anonymous context.
 *
 * Token verification + authorization (withTenantScope preHandler):
 *   Routes that require auth call `app.withTenantScope(...)` as a preHandler.
 *   The preHandler verifies the JWT (first call only, idempotent), populates
 *   request.auth, then checks tenant membership, role hierarchy, and module
 *   access.
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

  // Raw bearer token — stored by onRequest, consumed by withTenantScope.
  fastify.decorateRequest("bearerToken", null);

  fastify.decorate("withTenantScope", ((options?: TenantScopeOptions) =>
    buildTenantScopeGuard(options)) as TenantScopeDecorator);

  // ── Credential extraction hook ───────────────────────────────────────────
  // Extracts the bearer token string from the Authorization header and
  // stores it on the request. Does NOT verify the token — that happens in
  // the withTenantScope preHandler. Every request passes through.

  fastify.addHook("onRequest", async (request) => {
    request.auth = ANONYMOUS_CONTEXT();
    (request as RequestWithToken).bearerToken = extractBearerToken(request.headers.authorization);
  });
});

export default authContextPlugin;
