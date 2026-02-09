import { PropertyWithStatsSchema } from "@tartware/schemas";
import { z } from "zod";

import { query } from "../lib/db.js";
import { PROPERTY_LIST_SQL, PROPERTY_OPERATIONAL_STATS_SQL } from "../sql/property-queries.js";
import { toNonNegativeInt, toOptionalNumber } from "../utils/numbers.js";
import { normalizePhoneNumber } from "../utils/phone.js";

// API response type with version as string (BigInt serialized for JSON)
const PropertyWithStatsApiSchema = PropertyWithStatsSchema.omit({ version: true }).extend({
  version: z.string(),
});

type PropertyWithStatsApi = z.infer<typeof PropertyWithStatsApiSchema>;

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

type PropertyOperationalStats = {
  roomCount: number;
  occupiedRooms: number;
  currentGuests: number;
  todaysArrivals: number;
  todaysDepartures: number;
};

const mapRowToProperty = (
  row: PropertyRow,
  stats?: PropertyOperationalStats,
): PropertyWithStatsApi => {
  const totalRooms = toNonNegativeInt(row.total_rooms, 0);
  const roomCount = stats?.roomCount ?? totalRooms;
  const occupiedRooms = stats?.occupiedRooms ?? 0;
  const availableRooms = Math.max(roomCount - occupiedRooms, 0);
  const occupancyRate = roomCount > 0 ? occupiedRooms / roomCount : 0;

  const parsed = PropertyWithStatsApiSchema.parse({
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
    version: row.version ? row.version.toString() : "0",
    room_count: roomCount,
    occupied_rooms: occupiedRooms,
    available_rooms: availableRooms,
    occupancy_rate: occupancyRate,
    current_guests: stats?.currentGuests ?? 0,
    todays_arrivals: stats?.todaysArrivals ?? 0,
    todays_departures: stats?.todaysDepartures ?? 0,
  });

  return parsed;
};

const fetchPropertyOperationalStats = async (
  tenantId: string,
  propertyIds: string[],
): Promise<Map<string, PropertyOperationalStats>> => {
  if (propertyIds.length === 0) {
    return new Map();
  }

  const { rows } = await query<{
    property_id: string;
    room_count: string | number | null;
    occupied_rooms: string | number | null;
    current_guests: string | number | null;
    todays_arrivals: string | number | null;
    todays_departures: string | number | null;
  }>(PROPERTY_OPERATIONAL_STATS_SQL, [propertyIds, tenantId]);

  return rows.reduce<Map<string, PropertyOperationalStats>>((acc, row) => {
    acc.set(row.property_id, {
      roomCount: toNonNegativeInt(row.room_count, 0),
      occupiedRooms: toNonNegativeInt(row.occupied_rooms, 0),
      currentGuests: toNonNegativeInt(row.current_guests, 0),
      todaysArrivals: toNonNegativeInt(row.todays_arrivals, 0),
      todaysDepartures: toNonNegativeInt(row.todays_departures, 0),
    });
    return acc;
  }, new Map());
};

/**
 * List properties with optional tenant filtering and operational stats.
 */
export const listProperties = async (
  options: { limit?: number; offset?: number; tenantId?: string } = {},
): Promise<PropertyWithStatsApi[]> => {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const tenantId = options.tenantId ?? null;
  const { rows } = await query<PropertyRow>(PROPERTY_LIST_SQL, [limit, tenantId, offset]);
  if (rows.length === 0) {
    return [];
  }

  const propertyIds = rows.map((row) => row.id);
  const statsMap =
    tenantId && propertyIds.length > 0
      ? await fetchPropertyOperationalStats(tenantId, propertyIds)
      : new Map();

  return rows.map((row) => mapRowToProperty(row, statsMap.get(row.id)));
};
