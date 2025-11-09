import { type UserWithTenants, UserWithTenantsSchema } from "@tartware/schemas";

import { query } from "../lib/db.js";
import { USER_LIST_SQL } from "../sql/user-queries.js";
import { normalizePhoneNumber } from "../utils/phone.js";

type RawTenantEntry = {
  tenant_id: string;
  tenant_name: string | null;
  role: string;
  is_active: boolean | null;
};

type UserRow = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
  is_verified: boolean | null;
  email_verified_at: Date | null;
  last_login_at: Date | null;
  preferences: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  version: bigint | null;
  tenants: RawTenantEntry[] | null;
};

const mapRowToUser = (row: UserRow): UserWithTenants => {
  const tenants = Array.isArray(row.tenants)
    ? row.tenants
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
    email_verified_at: row.email_verified_at ?? undefined,
    last_login_at: row.last_login_at ?? undefined,
    preferences: row.preferences ?? {},
    metadata: row.metadata ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
    version: row.version ?? BigInt(0),
    tenants,
  });

  return parsed;
};

export const listUsers = async (
  options: { limit?: number; tenantId?: string } = {},
): Promise<UserWithTenants[]> => {
  const limit = options.limit ?? 50;
  const tenantId = options.tenantId ?? null;
  const { rows } = await query<UserRow>(USER_LIST_SQL, [limit, tenantId]);
  return rows.map(mapRowToUser);
};
