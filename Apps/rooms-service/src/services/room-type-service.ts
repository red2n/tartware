import { type RoomTypeItem, RoomTypeItemSchema } from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  buildDynamicUpdate,
  type UpdateField,
} from "../sql/dynamic-update-builder.js";
import {
  ROOM_TYPE_CREATE_SQL,
  ROOM_TYPE_DELETE_SQL,
  ROOM_TYPE_LIST_SQL,
} from "../sql/room-type-queries.js";

// Re-export schema for consumers that import from this module
export { RoomTypeItemSchema };

type RoomTypeRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  type_name: string;
  type_code: string;
  description: string | null;
  short_description: string | null;
  category: string | null;
  base_occupancy: number | null;
  max_occupancy: number | null;
  max_adults: number | null;
  max_children: number | null;
  extra_bed_capacity: number | null;
  size_sqm: string | number | null; // PostgreSQL numeric returns string
  bed_type: string | null;
  number_of_beds: number | null;
  amenities: unknown | null;
  features: unknown | null;
  base_price: string | number | null; // PostgreSQL numeric returns string
  currency: string | null;
  images: unknown | null;
  display_order: number | null;
  is_active: boolean | null;
  metadata: unknown | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  version: bigint | null;
};

/**
 * Convert PostgreSQL numeric (returned as string) to number.
 */
const toNumber = (value: string | number | null | undefined): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : undefined;
};

const toStringDate = (value: string | Date | null): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const mapRowToRoomType = (row: RoomTypeRow): RoomTypeItem =>
  RoomTypeItemSchema.parse({
    room_type_id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    type_name: row.type_name,
    type_code: row.type_code,
    description: row.description ?? undefined,
    short_description: row.short_description ?? undefined,
    category: row.category ?? "STANDARD",
    base_occupancy: row.base_occupancy ?? 2,
    max_occupancy: row.max_occupancy ?? 2,
    max_adults: row.max_adults ?? 2,
    max_children: row.max_children ?? undefined,
    extra_bed_capacity: row.extra_bed_capacity ?? undefined,
    size_sqm: toNumber(row.size_sqm),
    bed_type: row.bed_type ?? undefined,
    number_of_beds: row.number_of_beds ?? undefined,
    amenities: row.amenities ?? undefined,
    features: row.features ?? undefined,
    base_price: toNumber(row.base_price) ?? 0,
    currency: row.currency ?? undefined,
    images: row.images ?? undefined,
    display_order: row.display_order ?? undefined,
    is_active: row.is_active ?? true,
    metadata: row.metadata ?? undefined,
    created_at: toStringDate(row.created_at),
    updated_at: toStringDate(row.updated_at),
    version: row.version ? row.version.toString() : "0",
  });

const toJson = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
};

type CreateRoomTypeInput = {
  tenant_id: string;
  property_id: string;
  type_name: string;
  type_code: string;
  description?: string;
  short_description?: string;
  category?: string;
  base_occupancy?: number;
  max_occupancy?: number;
  max_adults?: number;
  max_children?: number;
  extra_bed_capacity?: number;
  size_sqm?: number;
  bed_type?: string;
  number_of_beds?: number;
  amenities?: unknown;
  features?: unknown;
  base_price: number;
  currency?: string;
  images?: unknown;
  display_order?: number;
  is_active?: boolean;
  metadata?: unknown;
  created_by?: string;
};

export const listRoomTypes = async (options: {
  tenantId: string;
  propertyId?: string;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<RoomTypeItem[]> => {
  const { rows } = await query<RoomTypeRow>(ROOM_TYPE_LIST_SQL, [
    options.tenantId,
    options.propertyId ?? null,
    options.isActive ?? null,
    options.search ? `%${options.search.trim()}%` : null,
    options.limit ?? 200,
    options.offset ?? 0,
  ]);

  return rows.map(mapRowToRoomType);
};

/**
 * Create a new room type.
 */
export const createRoomType = async (input: CreateRoomTypeInput): Promise<RoomTypeItem> => {
  const { rows } = await query<RoomTypeRow>(ROOM_TYPE_CREATE_SQL, [
    input.tenant_id,
    input.property_id,
    input.type_name,
    input.type_code,
    input.description ?? null,
    input.short_description ?? null,
    input.category ?? null,
    input.base_occupancy ?? null,
    input.max_occupancy ?? null,
    input.max_adults ?? null,
    input.max_children ?? null,
    input.extra_bed_capacity ?? null,
    input.size_sqm ?? null,
    input.bed_type ?? null,
    input.number_of_beds ?? null,
    toJson(input.amenities),
    toJson(input.features),
    input.base_price,
    input.currency ?? null,
    toJson(input.images),
    input.display_order ?? null,
    input.is_active ?? null,
    toJson(input.metadata),
    input.created_by ?? null,
  ]);

  if (!rows[0]) {
    throw new Error("Failed to create room type");
  }
  return mapRowToRoomType(rows[0]);
};

type UpdateRoomTypeInput = {
  tenant_id: string;
  room_type_id: string;
  property_id?: string;
  type_name?: string;
  type_code?: string;
  description?: string;
  short_description?: string;
  category?: string;
  base_occupancy?: number;
  max_occupancy?: number;
  max_adults?: number;
  max_children?: number;
  extra_bed_capacity?: number;
  size_sqm?: number;
  bed_type?: string;
  number_of_beds?: number;
  amenities?: unknown;
  features?: unknown;
  base_price?: number;
  currency?: string;
  images?: unknown;
  display_order?: number;
  is_active?: boolean;
  metadata?: unknown;
  updated_by?: string;
};

/**
 * Column mappings for room type updates.
 * Key = property on UpdateRoomTypeInput; column = DB column; json = needs JSON.stringify.
 */
const ROOM_TYPE_UPDATE_FIELDS: ReadonlyArray<{
  key: keyof UpdateRoomTypeInput;
  column: string;
  json?: boolean;
}> = [
  { key: "property_id", column: "property_id" },
  { key: "type_name", column: "type_name" },
  { key: "type_code", column: "type_code" },
  { key: "description", column: "description" },
  { key: "short_description", column: "short_description" },
  { key: "category", column: "category" },
  { key: "base_occupancy", column: "base_occupancy" },
  { key: "max_occupancy", column: "max_occupancy" },
  { key: "max_adults", column: "max_adults" },
  { key: "max_children", column: "max_children" },
  { key: "extra_bed_capacity", column: "extra_bed_capacity" },
  { key: "size_sqm", column: "size_sqm" },
  { key: "bed_type", column: "bed_type" },
  { key: "number_of_beds", column: "number_of_beds" },
  { key: "amenities", column: "amenities", json: true },
  { key: "features", column: "features", json: true },
  { key: "base_price", column: "base_price" },
  { key: "currency", column: "currency" },
  { key: "images", column: "images", json: true },
  { key: "display_order", column: "display_order" },
  { key: "is_active", column: "is_active" },
  { key: "metadata", column: "metadata", json: true },
  { key: "updated_by", column: "updated_by" },
];

/** Columns returned from the UPDATE CTE. */
const ROOM_TYPE_SELECT_COLUMNS = [
  "id", "tenant_id", "property_id", "type_name", "type_code",
  "description", "short_description", "category", "base_occupancy",
  "max_occupancy", "max_adults", "max_children", "extra_bed_capacity",
  "size_sqm", "bed_type", "number_of_beds", "amenities", "features",
  "base_price", "currency", "images", "display_order", "is_active",
  "metadata", "created_at", "updated_at", "version",
] as const;

/**
 * Update a room type by id.
 *
 * Uses a dynamic query builder so that only explicitly provided fields are
 * included in the SET clause. This distinguishes "not provided" (undefined →
 * column untouched) from "set to null" (null → column cleared), unlike the
 * former COALESCE($n, alias.column) approach.
 */
export const updateRoomType = async (input: UpdateRoomTypeInput): Promise<RoomTypeItem | null> => {
  const fields: UpdateField[] = [];
  for (const mapping of ROOM_TYPE_UPDATE_FIELDS) {
    const value = input[mapping.key];
    if (value !== undefined) {
      fields.push({
        column: mapping.column,
        value: mapping.json ? toJson(value) : value,
      });
    }
  }

  const { sql, params } = buildDynamicUpdate({
    table: "public.room_types",
    alias: "rt",
    id: input.room_type_id,
    tenantId: input.tenant_id,
    fields,
    selectColumns: ROOM_TYPE_SELECT_COLUMNS,
  });

  const { rows } = await query<RoomTypeRow>(sql, params);

  if (!rows[0]) {
    return null;
  }

  return mapRowToRoomType(rows[0]);
};

/**
 * Soft delete a room type by id.
 */
export const deleteRoomType = async (options: {
  tenant_id: string;
  room_type_id: string;
  deleted_by?: string;
}): Promise<boolean> => {
  const { rows } = await query<{ id: string }>(ROOM_TYPE_DELETE_SQL, [
    options.room_type_id,
    options.tenant_id,
    options.deleted_by ?? null,
  ]);

  return Boolean(rows[0]?.id);
};
