import type { RoomQueryRow } from "@tartware/schemas";
import type { RoomCandidate } from "../types.js";

export type { RoomQueryRow };

/**
 * Maps a raw room query row to a RoomCandidate pipeline entry.
 * Used by available-rooms, similar-rooms, and upgrade-opportunity sources.
 */
export const rowToRoomCandidate = (
  row: RoomQueryRow,
  source: RoomCandidate["source"],
  overrides?: Partial<RoomCandidate>,
): RoomCandidate => ({
  roomId: row.room_id,
  roomTypeId: row.room_type_id,
  roomTypeName: row.room_type_name,
  roomNumber: row.room_number,
  floor: row.floor,
  viewType: row.view_type ?? undefined,
  baseRate: Number(row.base_rate),
  status: row.status,
  maxOccupancy: row.max_occupancy,
  source,
  ...overrides,
});
