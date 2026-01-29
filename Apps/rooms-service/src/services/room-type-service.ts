import { type RoomTypeItem, RoomTypeItemSchema } from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  ROOM_TYPE_CREATE_SQL,
  ROOM_TYPE_DELETE_SQL,
  ROOM_TYPE_LIST_SQL,
  ROOM_TYPE_UPDATE_SQL,
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
  size_sqm: number | null;
  bed_type: string | null;
  number_of_beds: number | null;
  amenities: unknown | null;
  features: unknown | null;
  base_price: number | null;
  currency: string | null;
  images: unknown | null;
  display_order: number | null;
  is_active: boolean | null;
  metadata: unknown | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  version: bigint | null;
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
    size_sqm: row.size_sqm ?? undefined,
    bed_type: row.bed_type ?? undefined,
    number_of_beds: row.number_of_beds ?? undefined,
    amenities: row.amenities ?? undefined,
    features: row.features ?? undefined,
    base_price: row.base_price ?? 0,
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
}): Promise<RoomTypeItem[]> => {
  const { rows } = await query<RoomTypeRow>(ROOM_TYPE_LIST_SQL, [
    options.tenantId,
    options.propertyId ?? null,
    options.isActive ?? null,
    options.search ? `%${options.search.trim()}%` : null,
    options.limit ?? 200,
  ]);

  return rows.map(mapRowToRoomType);
};

/**
 * Create a new room type.
 */
export const createRoomType = async (
  input: CreateRoomTypeInput,
): Promise<RoomTypeItem> => {
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
 * Update a room type by id.
 */
export const updateRoomType = async (
  input: UpdateRoomTypeInput,
): Promise<RoomTypeItem | null> => {
  const { rows } = await query<RoomTypeRow>(ROOM_TYPE_UPDATE_SQL, [
    input.room_type_id,
    input.tenant_id,
    input.property_id ?? null,
    input.type_name ?? null,
    input.type_code ?? null,
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
    input.base_price ?? null,
    input.currency ?? null,
    toJson(input.images),
    input.display_order ?? null,
    input.is_active ?? null,
    toJson(input.metadata),
    input.updated_by ?? null,
  ]);

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
