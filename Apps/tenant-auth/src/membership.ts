import { type TenantMembership, type TenantMembershipRow, TenantRoleEnum } from "@tartware/schemas";

export type { TenantMembership };

type QueryFn = <T extends Record<string, unknown>>(
  sql: string,
  params: unknown[],
) => Promise<{ rows: T[] }>;

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
 * Create a `getUserMemberships` function bound to a database query function.
 *
 * @example
 * ```ts
 * import { createMembershipLoader } from "@tartware/tenant-auth/membership";
 * import { query } from "./lib/db.js";
 *
 * export const getUserMemberships = createMembershipLoader(query);
 * ```
 */
export const createMembershipLoader =
  (queryFn: QueryFn) =>
  async (userId: string): Promise<TenantMembership[]> => {
    const { rows } = await queryFn<TenantMembershipRow>(USER_MEMBERSHIP_SQL, [userId]);

    return rows.map((row) => ({
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      role: TenantRoleEnum.parse(row.role),
      isActive: row.is_active,
      permissions: row.permissions ?? {},
      modules: row.modules ?? [],
    }));
  };
