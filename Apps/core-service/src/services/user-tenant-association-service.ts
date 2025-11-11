import {
  TenantRoleEnum,
  type UserTenantAssociationWithDetails,
  UserTenantAssociationWithDetailsSchema,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import { normalizeModuleList } from "../modules/module-registry.js";
import {
  ACTIVE_MEMBERSHIPS_SQL,
  ASSOCIATION_LIST_SQL,
} from "../sql/user-tenant-association-queries.js";
import type { TenantMembership } from "../types/auth.js";

type AssociationRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  is_active: boolean;
  permissions: Record<string, unknown> | null;
  valid_from: Date | null;
  valid_until: Date | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: Date | null;
  version: bigint | null;
  user_username: string | null;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  tenant_status: string | null;
};

const mapRowToAssociation = (row: AssociationRow): UserTenantAssociationWithDetails => {
  const parsed = UserTenantAssociationWithDetailsSchema.parse({
    id: row.id,
    user_id: row.user_id,
    tenant_id: row.tenant_id,
    role: row.role,
    is_active: row.is_active,
    permissions: row.permissions ?? {},
    valid_from: row.valid_from ?? undefined,
    valid_until: row.valid_until ?? undefined,
    metadata: row.metadata ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
    deleted_at: row.deleted_at ?? null,
    version: row.version ?? BigInt(0),
    user:
      row.user_username && row.user_email
        ? {
            username: row.user_username,
            email: row.user_email,
            first_name: row.user_first_name ?? "",
            last_name: row.user_last_name ?? "",
          }
        : undefined,
    tenant:
      row.tenant_name && row.tenant_slug && row.tenant_status
        ? {
            name: row.tenant_name,
            slug: row.tenant_slug,
            status: row.tenant_status,
          }
        : undefined,
  });

  return parsed;
};

export const listUserTenantAssociations = async (
  options: {
    tenantId?: string;
    userId?: string;
    role?: string;
    isActive?: boolean;
    limit?: number;
  } = {},
): Promise<UserTenantAssociationWithDetails[]> => {
  const limit = options.limit ?? 50;
  const tenantId = options.tenantId ?? null;
  const userId = options.userId ?? null;
  const role = options.role ?? null;
  const isActive = options.isActive ?? null;

  const { rows } = await query<AssociationRow>(ASSOCIATION_LIST_SQL, [
    tenantId,
    userId,
    role,
    isActive,
    limit,
  ]);

  return rows.map(mapRowToAssociation);
};

export const getActiveUserTenantMemberships = async (
  userId: string,
): Promise<TenantMembership[]> => {
  const { rows } = await query<{
    tenant_id: string;
    role: string;
    is_active: boolean;
    permissions: Record<string, unknown> | null;
    tenant_name: string | null;
    modules: unknown;
  }>(ACTIVE_MEMBERSHIPS_SQL, [userId]);

  return rows.map((row) => {
    const role = TenantRoleEnum.parse(row.role);
    const modules = normalizeModuleList(row.modules);
    return {
      tenantId: row.tenant_id,
      tenantName: row.tenant_name ?? undefined,
      role,
      isActive: row.is_active,
      permissions: row.permissions ?? {},
      modules,
    } satisfies TenantMembership;
  });
};
