import {
  type UserRow,
  type UserTenantEntryRow,
  type UserWithTenants,
  UserWithTenantsSchema,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import { USER_LIST_SQL } from "../sql/user-queries.js";
import { normalizePhoneNumber } from "../utils/phone.js";

const mapRowToUser = (row: UserRow): UserWithTenants => {
  const tenants = Array.isArray(row.tenants)
    ? (row.tenants as UserTenantEntryRow[])
        .filter((tenant) => tenant?.tenant_id)
        .map((tenant) => ({
          tenant_id: tenant.tenant_id,
          tenant_name: tenant.tenant_name ?? "Unknown Tenant",
          role: tenant.role,
          is_active: tenant.is_active ?? true,
        }))
    : undefined;

  const parsed = UserWithTenantsSchema.parse({
    id: row.id,
    username: row.username,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: normalizePhoneNumber(row.phone),
    avatar_url: row.avatar_url ?? undefined,
    is_active: row.is_active ?? true,
    is_verified: row.is_verified ?? false,
    email_verified_at: (row.email_verified_at as Date) ?? undefined,
    last_login_at: (row.last_login_at as Date) ?? undefined,
    preferences: row.preferences ?? {},
    metadata: row.metadata ?? undefined,
    created_at: row.created_at as Date,
    updated_at: (row.updated_at as Date) ?? undefined,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
    version: BigInt(row.version ?? 0),
    tenants,
  });

  return parsed;
};

/**
 * List users with optional tenant filtering and pagination.
 */
export const listUsers = async (
  options: { limit?: number; offset?: number; tenantId?: string } = {},
): Promise<UserWithTenants[]> => {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const tenantId = options.tenantId ?? null;
  const { rows } = await query<UserRow>(USER_LIST_SQL, [limit, tenantId, offset]);
  return rows.map(mapRowToUser);
};
