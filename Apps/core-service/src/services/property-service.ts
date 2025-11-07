import { type PropertyWithStats, PropertyWithStatsSchema } from "@tartware/schemas";

import { query } from "../lib/db.js";
import { toNonNegativeInt, toOptionalNumber } from "../utils/numbers.js";
import { normalizePhoneNumber } from "../utils/phone.js";
import { PROPERTY_LIST_SQL } from "../sql/property-queries.js";

type PropertyRow = {
  id: string;
  tenant_id: string;
  property_name: string;
  property_code: string;
  address: Record<string, unknown>;
  phone: string | null;
  email: string | null;
  website: string | null;
  property_type: string | null;
  star_rating: number | string | null;
  total_rooms: number | string | null;
  tax_id: string | null;
  license_number: string | null;
  currency: string | null;
  timezone: string | null;
  config: Record<string, unknown>;
  integrations: Record<string, unknown>;
  is_active: boolean | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: Date | null;
  version: bigint | null;
};

const mapRowToProperty = (row: PropertyRow): PropertyWithStats => {
  const totalRooms = toNonNegativeInt(row.total_rooms, 0);

  const parsed = PropertyWithStatsSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_name: row.property_name,
    property_code: row.property_code,
    address: row.address,
    phone: normalizePhoneNumber(row.phone),
    email: row.email ?? undefined,
    website: row.website ?? undefined,
    property_type: row.property_type ?? undefined,
    star_rating: toOptionalNumber(row.star_rating),
    total_rooms: totalRooms,
    tax_id: row.tax_id ?? undefined,
    license_number: row.license_number ?? undefined,
    currency: row.currency ?? "USD",
    timezone: row.timezone ?? "UTC",
    config: row.config,
    integrations: row.integrations,
    is_active: row.is_active ?? true,
    metadata: row.metadata ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
    deleted_at: row.deleted_at ?? null,
    version: row.version ?? BigInt(0),
    room_count: totalRooms,
    occupied_rooms: 0,
    available_rooms: totalRooms,
    occupancy_rate: 0,
    current_guests: 0,
    todays_arrivals: 0,
    todays_departures: 0,
  });

  return parsed;
};

export const listProperties = async (
  options: { limit?: number; tenantId?: string } = {},
): Promise<PropertyWithStats[]> => {
  const limit = options.limit ?? 50;
  const tenantId = options.tenantId ?? null;
  const { rows } = await query<PropertyRow>(PROPERTY_LIST_SQL, [limit, tenantId]);
  return rows.map(mapRowToProperty);
};
