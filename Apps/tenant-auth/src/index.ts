import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import fp from "fastify-plugin";

export interface TenantMembershipBase {
  tenantId: string;
  role: string;
  isActive: boolean;
  modules: readonly string[] | string[];
}

export type AuthContext<Membership extends TenantMembershipBase> = {
  userId: string | null;
  isAuthenticated: boolean;
  memberships: Membership[];
  membershipMap: Map<string, Membership>;
  hasRole: (tenantId: string, role: Membership["role"]) => boolean;
  getMembership: (tenantId: string) => Membership | undefined;
  authorizedTenantIds: Set<string>;
};

type AccessTokenPayload = {
  sub?: string | null;
  [key: string]: unknown;
};

type RequestWithAuth<Membership extends TenantMembershipBase> = Omit<
  FastifyRequest,
  "auth"
> & {
  auth: AuthContext<Membership>;
};

export interface TenantScopeOptions<Membership extends TenantMembershipBase> {
  minRole?: Membership["role"];
  resolveTenantId?: (request: FastifyRequest) => string | undefined;
  allowMissingTenantId?: boolean;
  allowUnauthenticated?: boolean;
  requireActiveMembership?: boolean;
  requiredModules?: string | string[];
}

export type TenantScopeDecorator<Membership extends TenantMembershipBase> = (
  options?: TenantScopeOptions<Membership>,
) => preHandlerHookHandler;

/** Required callbacks/config to wire tenant auth into a service. */
export interface TenantAuthPluginOptions<Membership extends TenantMembershipBase> {
  /**
   * Resolves the full set of tenant memberships for a user identified by the
   * token subject. Return an empty array when the user has no memberships.
   */
  getUserMemberships: (userId: string) => Promise<Membership[]>;
  /**
   * Extracts a bearer token (e.g. strips the "Bearer " prefix) from the
   * Authorization header. Return null when no token is provided.
   */
  extractBearerToken: (authorizationHeader?: string) => string | null;
  /**
   * Verifies the bearer token and returns its payload (must include sub) when
   * valid. Return null for expired/invalid tokens to treat the request as
   * unauthenticated.
   */
  verifyAccessToken: (token: string) => AccessTokenPayload | null;
  /**
   * Role weight table used to compare membership privilege. Higher numbers
   * represent more privileged roles (e.g. ADMIN > STAFF).
   */
  rolePriority: Record<string, number>;
  /**
   * Optional escape hatch for routes (like health checks) that should skip
   * auth entirely.
   */
  shouldBypassAuth?: (request: FastifyRequest) => boolean;
}

const TENANT_SCOPE_DECORATOR_KEY: string = "withTenantScope";

const coerceModules = (modules: string[] | readonly string[] | undefined): string[] => {
  if (!Array.isArray(modules)) {
    return [];
  }
  return [...modules];
};

const createAuthContextFactory = <Membership extends TenantMembershipBase>(
  rolePriority: Record<string, number>,
) =>
  (userId: string | null, memberships: Membership[]): AuthContext<Membership> => {
    const membershipMap = new Map(
      memberships.map((membership) => [membership.tenantId, membership]),
    );

    const hasRole = (
      tenantId: string,
      requiredRole: Membership["role"],
    ): boolean => {
      const membership = membershipMap.get(tenantId);
      if (!membership) {
        return false;
      }
      return (
        (rolePriority[membership.role] ?? 0) >=
        (rolePriority[requiredRole] ?? 0)
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

const buildTenantScopeGuard = <Membership extends TenantMembershipBase>(
  options: TenantScopeOptions<Membership> = {},
): preHandlerHookHandler => {
  const {
    minRole,
    resolveTenantId,
    allowMissingTenantId = false,
    allowUnauthenticated = false,
    requireActiveMembership = true,
    requiredModules,
  } = options;

  const resolver = resolveTenantId ?? (() => undefined);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const scopedRequest = request as unknown as RequestWithAuth<Membership>;

    const sendError = (statusCode: number, message: string) => {
      reply.code(statusCode).send({ error: message });
    };

    if (!allowUnauthenticated && !scopedRequest.auth?.isAuthenticated) {
      sendError(401, "AUTHENTICATION_REQUIRED");
      return reply;
    }

    const tenantId = resolver(request) ?? undefined;

    if (!tenantId) {
      if (allowMissingTenantId) {
        return;
      }
      sendError(400, "TENANT_ID_REQUIRED");
      return reply;
    }

    const membership = scopedRequest.auth.getMembership(tenantId);
    if (!membership) {
      sendError(403, "TENANT_ACCESS_DENIED");
      return reply;
    }

    if (requireActiveMembership && !membership.isActive) {
      sendError(403, "TENANT_ACCESS_INACTIVE");
      return reply;
    }

    if (minRole && !scopedRequest.auth.hasRole(tenantId, minRole)) {
      sendError(403, "TENANT_ROLE_INSUFFICIENT");
      return reply;
    }

    const modules = Array.isArray(requiredModules)
      ? requiredModules
      : requiredModules
        ? [requiredModules]
        : [];

    if (modules.length > 0) {
      const enabledModules = new Set(coerceModules(membership.modules));
      const missing = modules.filter((moduleId) => !enabledModules.has(moduleId));
      if (missing.length > 0) {
        sendError(403, "TENANT_MODULE_NOT_ENABLED");
        return reply;
      }
    }

    scopedRequest.auth.authorizedTenantIds.add(tenantId);
  };
};

export const createTenantAuthPlugin = <
  Membership extends TenantMembershipBase,
>(
  options: TenantAuthPluginOptions<Membership>,
): FastifyPluginAsync => {
  const {
    getUserMemberships,
    extractBearerToken,
    verifyAccessToken,
    rolePriority,
    shouldBypassAuth,
  } = options;
  const createAuthContext = createAuthContextFactory<Membership>(rolePriority);

  return fp(async (fastify: FastifyInstance) => {
    const authStorage = new WeakMap<FastifyRequest, AuthContext<Membership>>();

    fastify.decorateRequest("auth", {
      getter(this: FastifyRequest) {
        return authStorage.get(this) || createAuthContext(null, []);
      },
      setter(this: FastifyRequest, value: AuthContext<Membership>) {
        authStorage.set(this, value);
      }
    } as any);

    const tenantScopeDecorator: TenantScopeDecorator<Membership> = (
      scopeOptions?: TenantScopeOptions<Membership>,
    ) => buildTenantScopeGuard(scopeOptions);

    fastify.decorate(TENANT_SCOPE_DECORATOR_KEY, tenantScopeDecorator);

    fastify.addHook("onRequest", async (request) => {
      const scopedRequest = request as unknown as RequestWithAuth<Membership>;

      if (shouldBypassAuth?.(request)) {
        scopedRequest.auth = createAuthContext(null, []);
        return;
      }

      const token = extractBearerToken(request.headers.authorization);

      if (!token) {
        scopedRequest.auth = createAuthContext(null, []);
        return;
      }

      const payload = verifyAccessToken(token);
      if (!payload?.sub) {
        scopedRequest.auth = createAuthContext(null, []);
        return;
      }

      try {
        const memberships = await getUserMemberships(payload.sub);
        scopedRequest.auth = createAuthContext(payload.sub, memberships);
      } catch (error) {
        request.log.error(error, "failed to load tenant memberships");
        scopedRequest.auth = createAuthContext(payload.sub, []);
      }
    });
  });
};
