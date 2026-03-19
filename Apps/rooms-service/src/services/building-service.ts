import { type BuildingItem, BuildingItemSchema, type BuildingRow } from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  BUILDING_CREATE_SQL,
  BUILDING_DELETE_SQL,
  BUILDING_LIST_SQL,
} from "../sql/building-queries.js";
import { buildDynamicUpdate, type UpdateField } from "../sql/dynamic-update-builder.js";

// Re-export schema for consumers that import from this module
export { BuildingItemSchema };

// BuildingRow imported from @tartware/schemas

const toStringDate = (value: string | Date | null): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return value;
};

const toJson = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
};

const mapRowToBuilding = (row: BuildingRow): BuildingItem =>
  BuildingItemSchema.parse({
    building_id: row.building_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    building_code: row.building_code,
    building_name: row.building_name,
    building_type: row.building_type ?? "MAIN",
    floor_count: row.floor_count ?? undefined,
    basement_floors: row.basement_floors ?? undefined,
    total_rooms: row.total_rooms ?? undefined,
    wheelchair_accessible: row.wheelchair_accessible ?? undefined,
    elevator_count: row.elevator_count ?? undefined,
    has_lobby: row.has_lobby ?? undefined,
    has_pool: row.has_pool ?? undefined,
    has_gym: row.has_gym ?? undefined,
    has_spa: row.has_spa ?? undefined,
    has_restaurant: row.has_restaurant ?? undefined,
    has_parking: row.has_parking ?? undefined,
    parking_spaces: row.parking_spaces ?? undefined,
    year_built: row.year_built ?? undefined,
    last_renovation_year: row.last_renovation_year ?? undefined,
    is_active: row.is_active ?? true,
    building_status: row.building_status ?? "OPERATIONAL",
    photo_url: row.photo_url ?? undefined,
    guest_description: row.guest_description ?? undefined,
    internal_notes: row.internal_notes ?? undefined,
    metadata: row.metadata ?? undefined,
    created_at: toStringDate(row.created_at),
    updated_at: toStringDate(row.updated_at),
    version: row.version ? row.version.toString() : "0",
  });

type CreateBuildingInput = {
  tenant_id: string;
  property_id: string;
  building_code: string;
  building_name: string;
  building_type?: string;
  floor_count?: number;
  basement_floors?: number;
  total_rooms?: number;
  wheelchair_accessible?: boolean;
  elevator_count?: number;
  has_lobby?: boolean;
  has_pool?: boolean;
  has_gym?: boolean;
  has_spa?: boolean;
  has_restaurant?: boolean;
  has_parking?: boolean;
  parking_spaces?: number;
  year_built?: number;
  last_renovation_year?: number;
  is_active?: boolean;
  building_status?: string;
  photo_url?: string;
  guest_description?: string;
  internal_notes?: string;
  metadata?: unknown;
  created_by?: string;
};

/**
 * List buildings for a tenant, with optional filters.
 */
export const listBuildings = async (options: {
  tenantId: string;
  propertyId?: string;
  isActive?: boolean;
  buildingType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<BuildingItem[]> => {
  const { rows } = await query<BuildingRow>(BUILDING_LIST_SQL, [
    options.tenantId,
    options.propertyId ?? null,
    options.isActive ?? null,
    options.buildingType ?? null,
    options.search ? `%${options.search.trim()}%` : null,
    options.limit ?? 200,
    options.offset ?? 0,
  ]);

  return rows.map(mapRowToBuilding);
};

/**
 * Create a new building.
 */
export const createBuilding = async (input: CreateBuildingInput): Promise<BuildingItem> => {
  const { rows } = await query<BuildingRow>(BUILDING_CREATE_SQL, [
    input.tenant_id,
    input.property_id,
    input.building_code,
    input.building_name,
    input.building_type ?? null,
    input.floor_count ?? null,
    input.basement_floors ?? null,
    input.total_rooms ?? null,
    input.wheelchair_accessible ?? null,
    input.elevator_count ?? null,
    input.has_lobby ?? null,
    input.has_pool ?? null,
    input.has_gym ?? null,
    input.has_spa ?? null,
    input.has_restaurant ?? null,
    input.has_parking ?? null,
    input.parking_spaces ?? null,
    input.year_built ?? null,
    input.last_renovation_year ?? null,
    input.is_active ?? null,
    input.building_status ?? null,
    input.photo_url ?? null,
    input.guest_description ?? null,
    input.internal_notes ?? null,
    toJson(input.metadata),
    input.created_by ?? null,
  ]);

  if (!rows[0]) {
    throw new Error("Failed to create building");
  }
  return mapRowToBuilding(rows[0]);
};

type UpdateBuildingInput = {
  tenant_id: string;
  building_id: string;
  property_id?: string;
  building_code?: string;
  building_name?: string;
  building_type?: string;
  floor_count?: number;
  basement_floors?: number;
  total_rooms?: number;
  wheelchair_accessible?: boolean;
  elevator_count?: number;
  has_lobby?: boolean;
  has_pool?: boolean;
  has_gym?: boolean;
  has_spa?: boolean;
  has_restaurant?: boolean;
  has_parking?: boolean;
  parking_spaces?: number;
  year_built?: number;
  last_renovation_year?: number;
  is_active?: boolean;
  building_status?: string;
  photo_url?: string;
  guest_description?: string;
  internal_notes?: string;
  metadata?: unknown;
  updated_by?: string;
};

/**
 * Column mappings for building updates.
 * Key = property on UpdateBuildingInput; column = DB column; json = needs JSON.stringify.
 */
const BUILDING_UPDATE_FIELDS: ReadonlyArray<{
  key: keyof UpdateBuildingInput;
  column: string;
  json?: boolean;
}> = [
  { key: "property_id", column: "property_id" },
  { key: "building_code", column: "building_code" },
  { key: "building_name", column: "building_name" },
  { key: "building_type", column: "building_type" },
  { key: "floor_count", column: "floor_count" },
  { key: "basement_floors", column: "basement_floors" },
  { key: "total_rooms", column: "total_rooms" },
  { key: "wheelchair_accessible", column: "wheelchair_accessible" },
  { key: "elevator_count", column: "elevator_count" },
  { key: "has_lobby", column: "has_lobby" },
  { key: "has_pool", column: "has_pool" },
  { key: "has_gym", column: "has_gym" },
  { key: "has_spa", column: "has_spa" },
  { key: "has_restaurant", column: "has_restaurant" },
  { key: "has_parking", column: "has_parking" },
  { key: "parking_spaces", column: "parking_spaces" },
  { key: "year_built", column: "year_built" },
  { key: "last_renovation_year", column: "last_renovation_year" },
  { key: "is_active", column: "is_active" },
  { key: "building_status", column: "building_status" },
  { key: "photo_url", column: "photo_url" },
  { key: "guest_description", column: "guest_description" },
  { key: "internal_notes", column: "internal_notes" },
  { key: "metadata", column: "metadata", json: true },
  { key: "updated_by", column: "updated_by" },
];

/** Columns returned from the UPDATE CTE. */
const BUILDING_SELECT_COLUMNS = [
  "building_id",
  "tenant_id",
  "property_id",
  "building_code",
  "building_name",
  "building_type",
  "floor_count",
  "basement_floors",
  "total_rooms",
  "wheelchair_accessible",
  "elevator_count",
  "has_lobby",
  "has_pool",
  "has_gym",
  "has_spa",
  "has_restaurant",
  "has_parking",
  "parking_spaces",
  "year_built",
  "last_renovation_year",
  "is_active",
  "building_status",
  "photo_url",
  "guest_description",
  "internal_notes",
  "metadata",
  "created_at",
  "updated_at",
  "version",
] as const;

/**
 * Update a building by id.
 *
 * Uses a dynamic query builder so that only explicitly provided fields are
 * included in the SET clause.
 */
export const updateBuilding = async (input: UpdateBuildingInput): Promise<BuildingItem | null> => {
  const fields: UpdateField[] = [];
  for (const mapping of BUILDING_UPDATE_FIELDS) {
    const value = input[mapping.key];
    if (value !== undefined) {
      fields.push({
        column: mapping.column,
        value: mapping.json ? toJson(value) : value,
      });
    }
  }

  const { sql, params } = buildDynamicUpdate({
    table: "public.buildings",
    alias: "b",
    id: input.building_id,
    tenantId: input.tenant_id,
    fields,
    selectColumns: BUILDING_SELECT_COLUMNS,
    pkColumn: "building_id",
  });

  const { rows } = await query<BuildingRow>(sql, params);

  if (!rows[0]) {
    return null;
  }

  return mapRowToBuilding(rows[0]);
};

/**
 * Soft delete a building by id.
 */
export const deleteBuilding = async (options: {
  tenant_id: string;
  building_id: string;
  deleted_by?: string;
}): Promise<boolean> => {
  const { rows } = await query<{ building_id: string }>(BUILDING_DELETE_SQL, [
    options.building_id,
    options.tenant_id,
    options.deleted_by ?? null,
  ]);

  return Boolean(rows[0]?.building_id);
};
