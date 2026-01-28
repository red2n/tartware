import { TenantRoleEnum } from "@tartware/schemas";

import { query } from "../lib/db.js";

type TenantMembershipRow = {
  tenant_id: string;
  tenant_name: string;
  role: string;
  is_active: boolean;
  permissions: Record<string, unknown> | null;
  modules: string[] | null;
};

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

type TenantRole = (typeof TenantRoleEnum)["_type"];

/**
 * Tenant membership view for a user.
 */
export type TenantMembership = {
  tenantId: string;
  tenantName: string;
  role: TenantRole;
  isActive: boolean;
  permissions: Record<string, unknown>;
  modules: string[];
};

/**
 * Fetch tenant memberships for a user.
 */
export const getUserMemberships = async (
  userId: string,
): Promise<TenantMembership[]> => {
  const { rows } = await query<TenantMembershipRow>(USER_MEMBERSHIP_SQL, [
    userId,
  ]);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    role: TenantRoleEnum.parse(row.role),
    isActive: row.is_active,
    permissions: row.permissions ?? {},
    modules: row.modules ?? [],
  }));
};
