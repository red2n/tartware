import {
  type AmenityCatalogItem,
  type AvailableRoom,
  type CreateRoomInput,
  type RoomGridItem,
  RoomGridItemSchema,
  type RoomGridRow,
  type RoomItem,
  RoomItemSchema,
  type RoomListRow,
  type UpdateRoomInput,
} from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  countRatesForRoomType,
  markRoomAvailable,
  markRoomInSetup,
  selectAmenityCatalog,
  selectAvailableRooms,
  softDeleteRoom,
  updateRoomAndReturnRow,
} from "../repositories/room-repository.js";
import {
  ROOM_CREATE_SQL,
  ROOM_GET_BY_ID_SQL,
  ROOM_GRID_SQL,
  ROOM_LIST_SQL,
} from "../sql/room-queries.js";

// Re-export schema for consumers that import from this module
export const RoomListItemSchema = RoomItemSchema;

// Internal type alias
type RoomListItem = RoomItem;

// Re-export service input types for route handlers
export type { CreateRoomInput, UpdateRoomInput };

// RoomListRow imported from @tartware/schemas

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
  const { value: status, display: statusDisplay } = normalizeEnum(row.status, "unknown");
  const { value: housekeepingStatus, display: housekeepingDisplay } = normalizeEnum(
    row.housekeeping_status,
    "unspecified",
  );
  const { value: maintenanceStatus, display: maintenanceDisplay } = normalizeEnum(
    row.maintenance_status,
    "normal",
  );

  // Return raw data - let UI decide how to merge/display
  const roomTypeAmenities = Array.isArray(row.room_type_amenities) ? row.room_type_amenities : [];
  const roomAmenities = Array.isArray(row.amenities) ? row.amenities : [];

  return RoomItemSchema.parse({
    room_id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    room_type_id: row.room_type_id ?? undefined,
    room_type_name: row.room_type_name ?? undefined,
    room_type_amenities: roomTypeAmenities.length > 0 ? roomTypeAmenities : undefined,
    room_number: row.room_number,
    room_name: row.room_name ?? undefined,
    floor: row.floor ?? undefined,
    building: row.building ?? undefined,
    building_id: row.building_id ?? undefined,
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

const mapRowToRoomGrid = (row: RoomGridRow): RoomGridItem => {
  const { value: status, display: statusDisplay } = normalizeEnum(row.status, "unknown");
  const { value: housekeepingStatus, display: housekeepingDisplay } = normalizeEnum(
    row.housekeeping_status,
    "unspecified",
  );
  const { display: maintenanceDisplay } = normalizeEnum(row.maintenance_status, "normal");

  return RoomGridItemSchema.parse({
    room_id: row.id,
    room_number: row.room_number,
    room_name: row.room_name ?? undefined,
    room_type_name: row.room_type_name ?? undefined,
    room_type_amenities: Array.isArray(row.room_type_amenities)
      ? row.room_type_amenities
      : undefined,
    floor: row.floor ?? undefined,
    status,
    status_display: statusDisplay,
    housekeeping_status: housekeepingStatus,
    housekeeping_display: housekeepingDisplay,
    maintenance_display: maintenanceDisplay,
    amenities: Array.isArray(row.amenities) ? row.amenities : undefined,
    is_blocked: Boolean(row.is_blocked),
    block_reason: row.block_reason ?? undefined,
    is_out_of_order: Boolean(row.is_out_of_order),
    out_of_order_reason: row.out_of_order_reason ?? undefined,
  });
};

/**
 * Create a new room in the inventory.
 */
export const createRoom = async (input: CreateRoomInput): Promise<RoomListItem> => {
  const { rows } = await query<RoomListRow>(ROOM_CREATE_SQL, [
    input.tenant_id,
    input.property_id,
    input.room_type_id,
    input.room_number,
    input.room_name ?? null,
    input.floor ?? null,
    input.building ?? null,
    input.building_id ?? null,
    input.wing ?? null,
    input.status ? input.status.trim().toUpperCase() : null,
    input.housekeeping_status ? input.housekeeping_status.trim().toUpperCase() : null,
    input.maintenance_status ? input.maintenance_status.trim().toUpperCase() : null,
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

export const updateRoom = async (input: UpdateRoomInput): Promise<RoomListItem | null> => {
  const { rows } = await updateRoomAndReturnRow(input);

  if (!rows[0]) {
    return null;
  }

  return mapRowToRoom(rows[0]);
};

export const listRoomGrid = async (options: {
  tenantId: string;
  propertyId?: string;
  status?: string;
  housekeepingStatus?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<RoomGridItem[]> => {
  const { rows } = await query<RoomGridRow>(ROOM_GRID_SQL, [
    options.limit ?? 200,
    options.tenantId,
    options.propertyId ?? null,
    options.status ?? null,
    options.housekeepingStatus ?? null,
    options.search ? `%${options.search.trim()}%` : null,
    options.offset ?? 0,
  ]);

  return rows.map(mapRowToRoomGrid);
};

/**
 * Soft delete a room by id.
 */
export const deleteRoom = async (options: {
  tenant_id: string;
  room_id: string;
  deleted_by?: string;
}): Promise<boolean> => {
  const { rows } = await softDeleteRoom(options);

  return Boolean(rows[0]?.id);
};

/**
 * Get a room by ID.
 */
export const getRoomById = async (options: {
  tenantId: string;
  roomId: string;
}): Promise<RoomListItem | null> => {
  const { rows } = await query<RoomListRow>(ROOM_GET_BY_ID_SQL, [options.roomId, options.tenantId]);

  if (!rows[0]) {
    return null;
  }

  return mapRowToRoom(rows[0]);
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
  offset?: number;
}): Promise<RoomListItem[]> => {
  const limit = options.limit ?? 200;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ? options.status.trim().toUpperCase() : null;
  const housekeepingStatus = options.housekeepingStatus
    ? options.housekeepingStatus.trim().toUpperCase()
    : null;
  const search = options.search ? `%${options.search.trim()}%` : null;
  const offset = options.offset ?? 0;

  const { rows } = await query<RoomListRow>(ROOM_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    housekeepingStatus,
    search,
    offset,
  ]);

  return rows.map(mapRowToRoom);
};

/**
 * Available room item for availability search results.
 */
// AvailableRoomItem is AvailableRoom from @tartware/schemas
type AvailableRoomItem = AvailableRoom;

/**
 * Search available rooms for a date range.
 * Finds rooms that are AVAILABLE, not locked in inventory_locks_shadow,
 * and not booked (CHECKED_IN/PENDING/CONFIRMED) for the given dates.
 */
export const searchAvailableRooms = async (options: {
  tenantId: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: string;
  buildingId?: string;
  /** When set, this reservation is excluded from the unassigned-count guard so
   *  the room picker during check-in does not hide the slot the current reservation
   *  is occupying in the availability math. */
  reservationId?: string;
  adults?: number;
  limit?: number;
  offset?: number;
}): Promise<AvailableRoomItem[]> => {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const { rows } = await selectAvailableRooms(options, limit, offset);

  return rows.map((r) => ({
    room_id: r.room_id,
    room_number: r.room_number,
    room_type_id: r.room_type_id,
    room_type_name: r.type_name,
    floor: r.floor,
    building_id: r.building_id,
    building_name: r.building_name,
    status: r.status,
    housekeeping_status: r.housekeeping_status,
    max_occupancy: Number(r.max_occupancy ?? 2),
    base_rate: Number(r.base_rate ?? 0),
    currency: r.currency ?? "USD",
    features: r.features ? (Array.isArray(r.features) ? r.features : []) : [],
    bed_type: r.bed_type ?? null,
    number_of_beds: Number(r.number_of_beds ?? 1),
    size_sqm: r.size_sqm != null ? Number(r.size_sqm) : null,
  }));
};

/**
 * Activate a room — transition from SETUP to AVAILABLE.
 * Validates that at least one active rate plan exists for the room type.
 */
export const activateRoom = async (input: {
  tenantId: string;
  roomId: string;
  activatedBy?: string;
}): Promise<{
  success: boolean;
  room?: RoomListItem;
  error?: string;
  kind?: "NOT_FOUND" | "INVALID_STATE" | "MISSING_RATES" | "CONFLICT";
}> => {
  // 1. Get the room and verify it's in SETUP status
  const room = await getRoomById({ tenantId: input.tenantId, roomId: input.roomId });
  if (!room) {
    return { success: false, kind: "NOT_FOUND", error: "Room not found" };
  }
  if (room.status !== "setup") {
    return {
      success: false,
      kind: "INVALID_STATE",
      error: `Room is already in ${room.status} status`,
    };
  }

  if (!room.room_type_id) {
    return { success: false, kind: "INVALID_STATE", error: "Room has no room type assigned" };
  }

  // 2. Check that at least one active rate exists for this room type
  const { rows: rateRows } = await countRatesForRoomType(input, room);

  const rateCount = Number.parseInt(rateRows[0]?.count ?? "0", 10);
  if (rateCount === 0) {
    return {
      success: false,
      kind: "MISSING_RATES",
      error:
        "Cannot activate room: no active rate plans exist for this room type. Please configure at least one rate plan first.",
    };
  }

  // 3. Transition to AVAILABLE
  const { rowCount } = await markRoomAvailable(input);

  if (!rowCount || rowCount === 0) {
    return {
      success: false,
      kind: "CONFLICT",
      error: "Failed to activate room — it may have been modified concurrently",
    };
  }

  // 4. Return the updated room
  const updated = await getRoomById({ tenantId: input.tenantId, roomId: input.roomId });
  return { success: true, room: updated ?? undefined };
};

/**
 * Deactivate a room — transition from AVAILABLE back to SETUP.
 * This removes the room from booking availability for reconfiguration.
 */
export const deactivateRoom = async (input: {
  tenantId: string;
  roomId: string;
  deactivatedBy?: string;
}): Promise<{
  success: boolean;
  room?: RoomListItem;
  error?: string;
  kind?: "NOT_FOUND" | "INVALID_STATE" | "CONFLICT";
}> => {
  const room = await getRoomById({ tenantId: input.tenantId, roomId: input.roomId });
  if (!room) {
    return { success: false, kind: "NOT_FOUND", error: "Room not found" };
  }
  if (room.status !== "available") {
    return {
      success: false,
      kind: "INVALID_STATE",
      error: `Only rooms in Available status can be deactivated. Current status: ${room.status}`,
    };
  }

  const { rowCount } = await markRoomInSetup(input);

  if (!rowCount || rowCount === 0) {
    return {
      success: false,
      kind: "CONFLICT",
      error: "Failed to deactivate room — it may have been modified concurrently",
    };
  }

  const updated = await getRoomById({ tenantId: input.tenantId, roomId: input.roomId });
  return { success: true, room: updated ?? undefined };
};

/**
 * List active amenities from the catalog for a given tenant.
 */
export const listAmenityCatalog = async (tenantId: string): Promise<AmenityCatalogItem[]> => {
  const { rows } = await selectAmenityCatalog(tenantId);
  return rows;
};
