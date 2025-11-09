import {
	type TenantWithRelations,
	TenantWithRelationsSchema,
} from "@tartware/schemas";import { query } from "../lib/db.js";
import { normalizePhoneNumber } from "../utils/phone.js";
import { TENANT_LIST_SQL } from "../sql/tenant-queries.js";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  email: string;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  business_license: string | null;
  registration_number: string | null;
  config: Record<string, unknown>;
  subscription: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: Date | null;
  version: bigint | null;
  property_count: number | null;
  user_count: number | null;
  active_properties: number | null;
};

const mapRowToTenant = (row: TenantRow): TenantWithRelations => {
  // Return object matching schema structure - validation happens at route level
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type as TenantWithRelations['type'],
    status: row.status as TenantWithRelations['status'],
    email: row.email,
    phone: normalizePhoneNumber(row.phone),
    website: row.website ?? undefined,
    address_line1: row.address_line1 ?? undefined,
    address_line2: row.address_line2 ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    postal_code: row.postal_code ?? undefined,
    country: row.country ?? undefined,
    tax_id: row.tax_id ?? undefined,
    business_license: row.business_license ?? undefined,
    registration_number: row.registration_number ?? undefined,
    config: row.config as TenantWithRelations['config'],
    subscription: row.subscription as TenantWithRelations['subscription'],
    metadata: row.metadata ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
    deleted_at: row.deleted_at ?? null,
    version: row.version ?? BigInt(0),
    property_count: row.property_count ?? 0,
    user_count: row.user_count ?? 0,
    active_properties: row.active_properties ?? 0,
  };
};

export const listTenants = async (options: { limit?: number; tenantIds?: string[] } = {}): Promise<TenantWithRelations[]> => {
  const limit = options.limit ?? 50;
  const tenantIds = options.tenantIds ?? [];

  // If tenantIds filter is provided, use it
  if (tenantIds.length > 0) {
    const placeholders = tenantIds.map((_, i) => `$${i + 2}`).join(', ');
    const filteredQuery = TENANT_LIST_SQL.replace(
      'WHERE COALESCE(t.is_deleted, false) = false AND t.deleted_at IS NULL',
      `WHERE COALESCE(t.is_deleted, false) = false AND t.deleted_at IS NULL AND t.id IN (${placeholders})`
    );
    const { rows } = await query<TenantRow>(filteredQuery, [limit, ...tenantIds]);
    return rows.map(mapRowToTenant);
  }

  const { rows } = await query<TenantRow>(TENANT_LIST_SQL, [limit]);
  return rows.map(mapRowToTenant);
};
