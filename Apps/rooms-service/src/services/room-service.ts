import { type RoomItem, RoomItemSchema } from "@tartware/schemas";

import { query } from "../lib/db.js";
import { ROOM_CREATE_SQL, ROOM_LIST_SQL } from "../sql/room-queries.js";

// Re-export schema for consumers that import from this module
export const RoomListItemSchema = RoomItemSchema;

// Internal type alias
type RoomListItem = RoomItem;

type CreateRoomInput = {
  tenant_id: string;
  property_id: string;
  room_type_id: string;
  room_number: string;
  room_name?: string;
  floor?: string;
  building?: string;
  wing?: string;
  status?: string;
  housekeeping_status?: string;
  maintenance_status?: string;
  features?: Record<string, unknown>;
  amenities?: unknown;
  is_blocked?: boolean;
  block_reason?: string;
  blocked_from?: string | Date;
  blocked_until?: string | Date;
  is_out_of_order?: boolean;
  out_of_order_reason?: string;
  out_of_order_since?: string | Date;
  expected_ready_date?: string | Date;
  notes?: string;
  housekeeping_notes?: string;
  metadata?: Record<string, unknown>;
  created_by?: string;
};

type UpdateRoomInput = {
  tenant_id: string;
  room_id: string;
  property_id?: string;
  room_type_id?: string;
  room_number?: string;
  room_name?: string;
  floor?: string;
  building?: string;
  wing?: string;
  status?: string;
  housekeeping_status?: string;
  maintenance_status?: string;
  features?: Record<string, unknown>;
  amenities?: unknown;
  is_blocked?: boolean;
  block_reason?: string;
  blocked_from?: string | Date;
  blocked_until?: string | Date;
  is_out_of_order?: boolean;
  out_of_order_reason?: string;
  out_of_order_since?: string | Date;
  expected_ready_date?: string | Date;
  notes?: string;
  housekeeping_notes?: string;
  metadata?: Record<string, unknown>;
  updated_by?: string;
};

type RoomListRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  room_type_id: string | null;
  room_type_name: string | null;
  room_type_amenities: string[] | null;
  room_number: string;
  room_name: string | null;
  floor: string | null;
  building: string | null;
  wing: string | null;
  status: string | null;
  housekeeping_status: string | null;
  maintenance_status: string | null;
  features: Record<string, unknown> | null;
  amenities: string[] | null;
  is_blocked: boolean | null;
  block_reason: string | null;
  is_out_of_order: boolean | null;
  out_of_order_reason: string | null;
  expected_ready_date: string | Date | null;
  housekeeping_notes: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string | Date | null;
  version: bigint | null;
};

const toJson = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
};

const toTitleCase = (value: string): string =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const normalizeEnum = (
  value: string | null,
  fallback: string,
): { value: string; display: string } => {
  if (!value || typeof value !== "string") {
    return { value: fallback, display: toTitleCase(fallback) };
  }
  const normalized = value.toLowerCase();
  return { value: normalized, display: toTitleCase(value) };
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

const mapRowToRoom = (row: RoomListRow): RoomItem => {
  const { value: status, display: statusDisplay } = normalizeEnum(
    row.status,
    "unknown",
  );
  const { value: housekeepingStatus, display: housekeepingDisplay } =
    normalizeEnum(row.housekeeping_status, "unspecified");
  const { value: maintenanceStatus, display: maintenanceDisplay } =
    normalizeEnum(row.maintenance_status, "normal");

  // Return raw data - let UI decide how to merge/display
  const roomTypeAmenities = Array.isArray(row.room_type_amenities)
    ? row.room_type_amenities
    : [];
  const roomAmenities = Array.isArray(row.amenities) ? row.amenities : [];

  return RoomItemSchema.parse({
    room_id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    room_type_id: row.room_type_id ?? undefined,
    room_type_name: row.room_type_name ?? undefined,
    room_type_amenities:
      roomTypeAmenities.length > 0 ? roomTypeAmenities : undefined,
    room_number: row.room_number,
    room_name: row.room_name ?? undefined,
    floor: row.floor ?? undefined,
    building: row.building ?? undefined,
    wing: row.wing ?? undefined,
    status,
    status_display: statusDisplay,
    housekeeping_status: housekeepingStatus,
    housekeeping_display: housekeepingDisplay,
    maintenance_status: maintenanceStatus,
    maintenance_display: maintenanceDisplay,
    features: row.features ?? undefined,
    amenities: roomAmenities.length > 0 ? roomAmenities : undefined,
    is_blocked: Boolean(row.is_blocked),
    block_reason: row.block_reason ?? undefined,
    is_out_of_order: Boolean(row.is_out_of_order),
    out_of_order_reason: row.out_of_order_reason ?? undefined,
    expected_ready_date: toStringDate(row.expected_ready_date),
    housekeeping_notes: row.housekeeping_notes ?? undefined,
    updated_at: toStringDate(row.updated_at),
    version: row.version ? row.version.toString() : "0",
  });
};

/**
 * Create a new room in the inventory.
 */
export const createRoom = async (
  input: CreateRoomInput,
): Promise<RoomListItem> => {
  const { rows } = await query<RoomListRow>(ROOM_CREATE_SQL, [
    input.tenant_id,
    input.property_id,
    input.room_type_id,
    input.room_number,
    input.room_name ?? null,
    input.floor ?? null,
    input.building ?? null,
    input.wing ?? null,
    input.status ? input.status.trim().toUpperCase() : null,
    input.housekeeping_status
      ? input.housekeeping_status.trim().toUpperCase()
      : null,
    input.maintenance_status
      ? input.maintenance_status.trim().toUpperCase()
      : null,
    toJson(input.features),
    toJson(input.amenities),
    input.is_blocked ?? null,
    input.block_reason ?? null,
    input.blocked_from ?? null,
    input.blocked_until ?? null,
    input.is_out_of_order ?? null,
    input.out_of_order_reason ?? null,
    input.out_of_order_since ?? null,
    input.expected_ready_date ?? null,
    input.notes ?? null,
    input.housekeeping_notes ?? null,
    toJson(input.metadata),
    input.created_by ?? null,
  ]);

  if (!rows[0]) {
    throw new Error("Failed to create room");
  }
  return mapRowToRoom(rows[0]);
};

export const updateRoom = async (
  input: UpdateRoomInput,
): Promise<RoomListItem | null> => {
  const { rows } = await query<RoomListRow>(
    `
      WITH updated AS (
        UPDATE public.rooms r
        SET
          property_id = COALESCE($3, r.property_id),
          room_type_id = COALESCE($4, r.room_type_id),
          room_number = COALESCE($5, r.room_number),
          room_name = COALESCE($6, r.room_name),
          floor = COALESCE($7, r.floor),
          building = COALESCE($8, r.building),
          wing = COALESCE($9, r.wing),
          status = COALESCE($10, r.status),
          housekeeping_status = COALESCE($11, r.housekeeping_status),
          maintenance_status = COALESCE($12, r.maintenance_status),
          features = COALESCE($13, r.features),
          amenities = COALESCE($14, r.amenities),
          is_blocked = COALESCE($15, r.is_blocked),
          block_reason = COALESCE($16, r.block_reason),
          blocked_from = COALESCE($17, r.blocked_from),
          blocked_until = COALESCE($18, r.blocked_until),
          is_out_of_order = COALESCE($19, r.is_out_of_order),
          out_of_order_reason = COALESCE($20, r.out_of_order_reason),
          out_of_order_since = COALESCE($21, r.out_of_order_since),
          expected_ready_date = COALESCE($22, r.expected_ready_date),
          notes = COALESCE($23, r.notes),
          housekeeping_notes = COALESCE($24, r.housekeeping_notes),
          metadata = COALESCE($25, r.metadata),
          updated_at = CURRENT_TIMESTAMP,
          updated_by = COALESCE($26, r.updated_by),
          version = r.version + 1
        WHERE r.id = $1::uuid
          AND r.tenant_id = $2::uuid
          AND COALESCE(r.is_deleted, false) = false
          AND r.deleted_at IS NULL
        RETURNING *
      )
      SELECT
        u.id,
        u.tenant_id,
        u.property_id,
        p.property_name,
        u.room_type_id,
        rt.type_name AS room_type_name,
        rt.amenities AS room_type_amenities,
        u.room_number,
        u.room_name,
        u.floor,
        u.building,
        u.wing,
        u.status,
        u.housekeeping_status,
        u.maintenance_status,
        u.features,
        u.amenities,
        u.is_blocked,
        u.block_reason,
        u.is_out_of_order,
        u.out_of_order_reason,
        u.expected_ready_date,
        u.housekeeping_notes,
        u.metadata,
        u.updated_at,
        u.version
      FROM updated u
      LEFT JOIN public.room_types rt
        ON u.room_type_id = rt.id
      LEFT JOIN public.properties p
        ON u.property_id = p.id
    `,
    [
      input.room_id,
      input.tenant_id,
      input.property_id ?? null,
      input.room_type_id ?? null,
      input.room_number ?? null,
      input.room_name ?? null,
      input.floor ?? null,
      input.building ?? null,
      input.wing ?? null,
      input.status ? input.status.trim().toUpperCase() : null,
      input.housekeeping_status
        ? input.housekeeping_status.trim().toUpperCase()
        : null,
      input.maintenance_status
        ? input.maintenance_status.trim().toUpperCase()
        : null,
      toJson(input.features),
      toJson(input.amenities),
      input.is_blocked ?? null,
      input.block_reason ?? null,
      input.blocked_from ?? null,
      input.blocked_until ?? null,
      input.is_out_of_order ?? null,
      input.out_of_order_reason ?? null,
      input.out_of_order_since ?? null,
      input.expected_ready_date ?? null,
      input.notes ?? null,
      input.housekeeping_notes ?? null,
      toJson(input.metadata),
      input.updated_by ?? null,
    ],
  );

  if (!rows[0]) {
    return null;
  }

  return mapRowToRoom(rows[0]);
};

/**
 * Soft delete a room by id.
 */
export const deleteRoom = async (options: {
  tenant_id: string;
  room_id: string;
  deleted_by?: string;
}): Promise<boolean> => {
  const { rows } = await query<{ id: string }>(
    `
      UPDATE public.rooms r
      SET
        is_deleted = true,
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = COALESCE($3, r.deleted_by),
        updated_at = CURRENT_TIMESTAMP,
        updated_by = COALESCE($3, r.updated_by),
        version = r.version + 1
      WHERE r.id = $1::uuid
        AND r.tenant_id = $2::uuid
        AND COALESCE(r.is_deleted, false) = false
        AND r.deleted_at IS NULL
      RETURNING r.id
    `,
    [options.room_id, options.tenant_id, options.deleted_by ?? null],
  );

  return Boolean(rows[0]?.id);
};

/**
 * List rooms with optional filters and search.
 */
export const listRooms = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  housekeepingStatus?: string;
  search?: string;
}): Promise<RoomListItem[]> => {
  const limit = options.limit ?? 200;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ? options.status.trim().toUpperCase() : null;
  const housekeepingStatus = options.housekeepingStatus
    ? options.housekeepingStatus.trim().toUpperCase()
    : null;
  const search = options.search ? `%${options.search.trim()}%` : null;

  const { rows } = await query<RoomListRow>(ROOM_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    housekeepingStatus,
    search,
  ]);

  return rows.map(mapRowToRoom);
};
