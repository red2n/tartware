import { TenantRoleEnum } from "@tartware/schemas";

import { query } from "../lib/db.js";

type TenantMembershipRow = {
  tenant_id: string;
  role: string;
  is_active: boolean;
  permissions: Record<string, unknown> | null;
  modules: string[] | null;
};

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

type TenantRole = (typeof TenantRoleEnum)["_type"];

export type TenantMembership = {
  tenantId: string;
  role: TenantRole;
  isActive: boolean;
  permissions: Record<string, unknown>;
  modules: string[];
};

export const getUserTenantMembership = async (
  userId: string,
  tenantId: string,
): Promise<TenantMembership | null> => {
  const { rows } = await query<TenantMembershipRow>(USER_TENANT_MEMBERSHIP_SQL, [userId, tenantId]);
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
