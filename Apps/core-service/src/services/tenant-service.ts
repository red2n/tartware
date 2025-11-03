import {
  type TenantWithRelations,
  TenantWithRelationsSchema,
} from "@tartware/schemas/core/tenants";

import { query } from "../lib/db.js";
import { normalizePhoneNumber } from "../utils/phone.js";

const TENANT_LIST_SQL = `
  SELECT
    t.id,
    t.name,
    t.slug,
    t.type,
    t.status,
    t.email,
    t.phone,
    t.website,
    t.address_line1,
    t.address_line2,
    t.city,
    t.state,
    t.postal_code,
    t.country,
    t.tax_id,
    t.business_license,
    t.registration_number,
    t.config,
    t.subscription,
    t.metadata,
    t.created_at,
    t.updated_at,
    t.created_by,
    t.updated_by,
    t.deleted_at,
    t.version,
    COALESCE(pc.property_count, 0) AS property_count,
    COALESCE(uc.user_count, 0) AS user_count,
    COALESCE(apc.active_properties, 0) AS active_properties
  FROM public.tenants t
  LEFT JOIN (
    SELECT tenant_id, COUNT(*)::int AS property_count
    FROM public.properties
    WHERE COALESCE(is_deleted, false) = false AND deleted_at IS NULL
    GROUP BY tenant_id
  ) pc ON pc.tenant_id = t.id
  LEFT JOIN (
    SELECT tenant_id, COUNT(*)::int AS user_count
    FROM public.user_tenant_associations
    WHERE COALESCE(is_deleted, false) = false AND deleted_at IS NULL
    GROUP BY tenant_id
  ) uc ON uc.tenant_id = t.id
  LEFT JOIN (
    SELECT tenant_id, COUNT(*)::int AS active_properties
    FROM public.properties
    WHERE COALESCE(is_deleted, false) = false AND deleted_at IS NULL AND is_active = true
    GROUP BY tenant_id
  ) apc ON apc.tenant_id = t.id
  WHERE COALESCE(t.is_deleted, false) = false AND t.deleted_at IS NULL
  ORDER BY t.created_at DESC
  LIMIT $1
`;

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

type TenantResponse = Omit<TenantWithRelations, "version"> & {
  version: string;
};

const mapRowToTenant = (row: TenantRow): TenantResponse => {
  const parsed = TenantWithRelationsSchema.parse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    status: row.status,
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
    config: row.config,
    subscription: row.subscription,
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
  });
  return {
    ...parsed,
    version: parsed.version?.toString() ?? "0",
  };
};

export const listTenants = async (options: { limit?: number } = {}): Promise<TenantResponse[]> => {
  const limit = options.limit ?? 50;
  const { rows } = await query<TenantRow>(TENANT_LIST_SQL, [limit]);
  return rows.map(mapRowToTenant);
};
