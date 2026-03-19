import { type TenantMembership, type TenantMembershipRow, TenantRoleEnum } from "@tartware/schemas";

export type { TenantMembership } from "@tartware/schemas";

import { query } from "../lib/db.js";

const USER_MEMBERSHIP_SQL = `
  SELECT
    uta.tenant_id,
    t.name AS tenant_name,
    uta.role,
    uta.is_active,
    uta.permissions,
    uta.modules
  FROM public.user_tenant_associations uta
  JOIN public.tenants t ON t.id = uta.tenant_id
  WHERE uta.user_id = $1::uuid
    AND COALESCE(uta.is_deleted, false) = false
    AND uta.deleted_at IS NULL
`;

/**
 * Fetch tenant memberships for a user.
 */
export const getUserMemberships = async (userId: string): Promise<TenantMembership[]> => {
  const { rows } = await query<TenantMembershipRow>(USER_MEMBERSHIP_SQL, [userId]);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    role: TenantRoleEnum.parse(row.role),
    isActive: row.is_active,
    permissions: row.permissions ?? {},
    modules: row.modules ?? [],
  }));
};
