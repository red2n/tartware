import type { TenantRole } from "@tartware/schemas";
import type { FastifyRequest, preHandlerHookHandler } from "fastify";

type TenantScopeResolver = (request: FastifyRequest) => string | null | undefined;

export type RolePriorityMap = Record<TenantRole, number>;

export interface TenantMembership {
  tenantId: string;
  role: TenantRole;
  isActive: boolean;
  permissions: Record<string, unknown>;
}

export interface AuthContext {
  userId: string | null;
  isAuthenticated: boolean;
  memberships: TenantMembership[];
  /** Quick lookup table for tenant-based authorisation */
  membershipMap: Map<string, TenantMembership>;
  /** Tracks tenant IDs validated by guards within the request lifecycle */
  authorizedTenantIds: Set<string>;
  getMembership: (tenantId: string) => TenantMembership | undefined;
  hasRole: (tenantId: string, minimumRole: TenantRole) => boolean;
}

export interface TenantScopeOptions {
  /** Minimum role required to access the tenant scoped resource. Defaults to STAFF. */
  minRole?: TenantRole;
  /** Function that extracts the tenant identifier from the request. */
  resolveTenantId?: TenantScopeResolver;
  /**
   * Allows requests that do not declare a tenant ID to continue.
   * Useful for endpoints that handle tenant discovery; default is false.
   */
  allowMissingTenantId?: boolean;
  /**
   * Allow unauthenticated requests to proceed. Defaults to false, enforcing authentication.
   */
  allowUnauthenticated?: boolean;
  /**
   * When true, the guard will reject inactive tenant memberships.
   * Defaults to true.
   */
  requireActiveMembership?: boolean;
  /** Require the user to hold at least this role across any tenant membership. */
  requireAnyTenantWithRole?: TenantRole;
}

export type TenantScopeDecorator = (options?: TenantScopeOptions) => preHandlerHookHandler;
