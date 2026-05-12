import {
  type UserTenantAssociationRow,
  type UserTenantAssociationWithDetails,
  UserTenantAssociationWithDetailsSchema,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import { ASSOCIATION_LIST_SQL } from "../sql/user-tenant-association-queries.js";

const mapRowToAssociation = (row: UserTenantAssociationRow): UserTenantAssociationWithDetails => {
  const parsed = UserTenantAssociationWithDetailsSchema.parse({
    id: row.id,
    user_id: row.user_id,
    tenant_id: row.tenant_id,
    role: row.role,
    is_active: row.is_active,
    permissions: row.permissions ?? {},
    valid_from: (row.valid_from as Date) ?? undefined,
    valid_until: (row.valid_until as Date) ?? undefined,
    metadata: row.metadata ?? undefined,
    created_at: row.created_at as Date,
    updated_at: (row.updated_at as Date) ?? undefined,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
    deleted_at: (row.deleted_at as Date) ?? null,
    version: BigInt(row.version ?? 0),
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

/**
 * List user-tenant associations with optional filters and pagination.
 */
export const listUserTenantAssociations = async (
  options: {
    tenantId?: string;
    userId?: string;
    role?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<UserTenantAssociationWithDetails[]> => {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const tenantId = options.tenantId ?? null;
  const userId = options.userId ?? null;
  const role = options.role ?? null;
  const isActive = options.isActive ?? null;

  const { rows } = await query<UserTenantAssociationRow>(ASSOCIATION_LIST_SQL, [
    tenantId,
    userId,
    role,
    isActive,
    limit,
    offset,
  ]);

  return rows.map(mapRowToAssociation);
};
