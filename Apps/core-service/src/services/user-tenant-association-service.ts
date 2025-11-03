import {
  type UserTenantAssociationWithDetails,
  UserTenantAssociationWithDetailsSchema,
} from "@tartware/schemas/core/user-tenant-associations";

import { query } from "../lib/db.js";

const ASSOCIATION_LIST_SQL = `
  SELECT
    uta.id,
    uta.user_id,
    uta.tenant_id,
    uta.role,
    uta.is_active,
    uta.permissions,
    uta.valid_from,
    uta.valid_until,
    uta.metadata,
    uta.created_at,
    uta.updated_at,
    uta.created_by,
    uta.updated_by,
    uta.deleted_at,
    uta.version,
    u.username AS user_username,
    u.email AS user_email,
    u.first_name AS user_first_name,
    u.last_name AS user_last_name,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    t.status AS tenant_status
  FROM public.user_tenant_associations uta
  LEFT JOIN public.users u ON u.id = uta.user_id
  LEFT JOIN public.tenants t ON t.id = uta.tenant_id
  WHERE COALESCE(uta.is_deleted, false) = false
    AND uta.deleted_at IS NULL
    AND ($1::uuid IS NULL OR uta.tenant_id = $1::uuid)
    AND ($2::uuid IS NULL OR uta.user_id = $2::uuid)
    AND ($3::tenant_role IS NULL OR uta.role = $3::tenant_role)
    AND ($4::boolean IS NULL OR uta.is_active = $4)
  ORDER BY uta.created_at DESC
  LIMIT $5
`;

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
