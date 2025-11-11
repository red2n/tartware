import { z } from "zod";

import { query } from "../lib/db.js";
import { ROOM_LIST_SQL } from "../sql/room-queries.js";

export const RoomListItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  property_name: z.string().optional(),
  room_type_id: z.string().uuid().optional(),
  room_type_name: z.string().optional(),
  room_number: z.string(),
  room_name: z.string().optional(),
  floor: z.string().optional(),
  building: z.string().optional(),
  wing: z.string().optional(),
  status: z.string(),
  status_display: z.string(),
  housekeeping_status: z.string(),
  housekeeping_display: z.string(),
  maintenance_status: z.string(),
  maintenance_display: z.string(),
  is_blocked: z.boolean(),
  block_reason: z.string().optional(),
  is_out_of_order: z.boolean(),
  out_of_order_reason: z.string().optional(),
  expected_ready_date: z.string().optional(),
  housekeeping_notes: z.string().optional(),
  updated_at: z.string().optional(),
  version: z.string(),
});

export type RoomListItem = z.infer<typeof RoomListItemSchema>;

type RoomListRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  room_type_id: string | null;
  room_type_name: string | null;
  room_number: string;
  room_name: string | null;
  floor: string | null;
  building: string | null;
  wing: string | null;
  status: string | null;
  housekeeping_status: string | null;
  maintenance_status: string | null;
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

const toTitleCase = (value: string): string =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const normalizeEnum = (
  value: string | null,
  fallback: string,
): { value: string; display: string } => {
  if (!value) {
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

const mapRowToRoom = (row: RoomListRow): RoomListItem => {
  const { value: status, display: statusDisplay } = normalizeEnum(row.status, "unknown");
  const { value: housekeepingStatus, display: housekeepingDisplay } = normalizeEnum(
    row.housekeeping_status,
    "unspecified",
  );
  const { value: maintenanceStatus, display: maintenanceDisplay } = normalizeEnum(
    row.maintenance_status,
    "normal",
  );

  return RoomListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    room_type_id: row.room_type_id ?? undefined,
    room_type_name: row.room_type_name ?? undefined,
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
