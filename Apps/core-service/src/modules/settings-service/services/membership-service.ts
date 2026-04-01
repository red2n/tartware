import {
  type TenantMembership as FullTenantMembership,
  type TenantMembershipRow,
  TenantRoleEnum,
} from "@tartware/schemas";

import { query } from "../lib/db.js";

/** Subset of TenantMembershipRow for single-tenant lookup (no tenant_name join). */
type SettingsMembershipRow = Omit<TenantMembershipRow, "tenant_name">;

/** Tenant membership without tenant name (looked up by specific tenant_id). */
export type TenantMembership = Omit<FullTenantMembership, "tenantName">;

const USER_TENANT_MEMBERSHIP_SQL = `
  SELECT
    uta.tenant_id,
    uta.role,
    uta.is_active,
    uta.permissions,
    uta.modules
  FROM public.user_tenant_associations uta
  JOIN public.tenants t ON t.id = uta.tenant_id
  WHERE uta.user_id = $1::uuid
    AND uta.tenant_id = $2::uuid
    AND COALESCE(uta.is_deleted, false) = false
    AND uta.deleted_at IS NULL
    AND COALESCE(t.is_deleted, false) = false
    AND t.deleted_at IS NULL
`;

/**
 * Fetch a user's membership for a specific tenant.
 */
export const getUserTenantMembership = async (
  userId: string,
  tenantId: string,
): Promise<TenantMembership | null> => {
  const { rows } = await query<SettingsMembershipRow>(USER_TENANT_MEMBERSHIP_SQL, [
    userId,
    tenantId,
  ]);
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    tenantId: row.tenant_id,
    role: TenantRoleEnum.parse(row.role),
    isActive: row.is_active,
    permissions: row.permissions ?? {},
    modules: row.modules ?? [],
  };
};
