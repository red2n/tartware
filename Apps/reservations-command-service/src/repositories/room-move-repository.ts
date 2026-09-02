import type { PoolClient } from "pg";

import { query } from "../lib/db.js";

/**
 * Reads and writes for moving an in-house guest between rooms (PMS-02-02).
 *
 * A move touches three tables that must agree afterwards: `reservation_rooms`
 * holds the assignment, `reservation_nights` holds what each night costs, and
 * `reservations` carries the denormalised room number the read APIs return.
 * Keeping the statements here rather than in the handler is what finding 04
 * asked for, and it makes the "which nights are still ahead" rule visible in
 * one place instead of inlined in a command.
 */

export type ReservationRoomRow = {
  reservation_room_id: string;
  reservation_id: string;
  property_id: string;
  room_sequence: number;
  room_type_id: string;
  room_id: string | null;
  room_number: string | null;
  guest_id: string | null;
  do_not_move: boolean;
  status: string;
};

/**
 * Every room on a booking, in sequence order.
 *
 * The move command reads all of them rather than the one it was given: with
 * more than one room it has to refuse an ambiguous request, and it cannot know
 * the request is ambiguous without counting.
 */
export const fetchReservationRooms = async (
  tenantId: string,
  reservationId: string,
): Promise<ReservationRoomRow[]> => {
  const { rows } = await query<ReservationRoomRow>(
    `SELECT reservation_room_id, reservation_id, property_id, room_sequence,
            room_type_id, room_id, room_number, guest_id, do_not_move, status
       FROM public.reservation_rooms
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      ORDER BY room_sequence`,
    [tenantId, reservationId],
  );
  return rows;
};

type TargetRoomRow = {
  id: string;
  room_number: string;
  room_type_id: string;
  property_id: string;
  status: string;
  housekeeping_status: string;
  is_blocked: boolean;
  is_out_of_order: boolean;
};

/** The room a guest is being moved into, with everything needed to refuse. */
export const fetchTargetRoom = async (
  tenantId: string,
  roomId: string,
): Promise<TargetRoomRow | null> => {
  const { rows } = await query<TargetRoomRow>(
    `SELECT id, room_number, room_type_id, property_id, status, housekeeping_status,
            COALESCE(is_blocked, false) AS is_blocked,
            COALESCE(is_out_of_order, false) AS is_out_of_order
       FROM public.rooms
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1`,
    [tenantId, roomId],
  );
  return rows[0] ?? null;
};

/** Point a booking's room row at its new room. */
export const applyRoomMove = async (
  client: PoolClient,
  input: {
    tenantId: string;
    reservationRoomId: string;
    toRoomId: string;
    toRoomNumber: string;
    toRoomTypeId: string;
    actorId: string;
  },
): Promise<void> => {
  await client.query(
    `UPDATE public.reservation_rooms
        SET room_id = $3::uuid,
            room_number = $4,
            room_type_id = $5::uuid,
            updated_at = NOW(),
            updated_by = $6::uuid
      WHERE tenant_id = $1::uuid
        AND reservation_room_id = $2::uuid`,
    [
      input.tenantId,
      input.reservationRoomId,
      input.toRoomId,
      input.toRoomNumber,
      input.toRoomTypeId,
      input.actorId,
    ],
  );
};

type NightRepriceResult = {
  repriced: number;
  amount_before: string;
  amount_after: string;
};

/**
 * Re-rate the nights the guest has not slept yet.
 *
 * `stay_date >= $3` is the whole rule. A guest moved on the third night of five
 * slept two nights in the old room at the old price, and no amount of moving
 * changes what those nights cost — re-rating them would silently rewrite a
 * charge the guest has already been told about, which is the sort of thing that
 * turns up in a chargeback.
 *
 * Nights priced by hand are left alone: `is_rate_override` means someone made a
 * deliberate decision about that night, and a room move is not a reason to
 * discard it.
 */
export const repriceRemainingNights = async (
  client: PoolClient,
  input: {
    tenantId: string;
    reservationRoomId: string;
    fromDate: Date;
    newRateAmount: number;
    newRateCode: string | null;
    actorId: string;
  },
): Promise<NightRepriceResult> => {
  const { rows } = await client.query<NightRepriceResult>(
    `WITH affected AS (
       SELECT reservation_night_id, rate_amount
         FROM public.reservation_nights
        WHERE tenant_id = $1::uuid
          AND reservation_room_id = $2::uuid
          AND stay_date >= $3::date
          AND COALESCE(is_rate_override, false) = false
          AND COALESCE(is_complimentary, false) = false
     ), updated AS (
       UPDATE public.reservation_nights n
          SET rate_amount = $4::numeric,
              rate_code = COALESCE($5, n.rate_code),
              updated_at = NOW(),
              updated_by = $6::uuid
         FROM affected a
        WHERE n.reservation_night_id = a.reservation_night_id
        RETURNING a.rate_amount AS before_amount, n.rate_amount AS after_amount
     )
     SELECT COUNT(*)::int AS repriced,
            COALESCE(SUM(before_amount), 0)::text AS amount_before,
            COALESCE(SUM(after_amount), 0)::text AS amount_after
       FROM updated`,
    [
      input.tenantId,
      input.reservationRoomId,
      input.fromDate,
      input.newRateAmount,
      input.newRateCode,
      input.actorId,
    ],
  );
  return rows[0] ?? { repriced: 0, amount_before: "0", amount_after: "0" };
};

/**
 * Set both rooms' status in one statement.
 *
 * The vacated room and the occupied one always change together — a move that
 * updated one and failed on the other would leave either a room sold twice or a
 * room nobody can sell. One statement, one outcome.
 */
export const applyRoomStatuses = async (
  client: PoolClient,
  input: {
    tenantId: string;
    fromRoomId: string | null;
    toRoomId: string;
    fromHousekeepingStatus: string;
    actorId: string;
  },
): Promise<void> => {
  await client.query(
    // Both columns are Postgres enums (room_status, housekeeping_status), and a
    // bare literal in a CASE arm arrives as text — "column status is of type
    // room_status but expression is of type text". The casts are not cosmetic.
    `UPDATE public.rooms
        SET status = CASE WHEN id = $3::uuid THEN 'OCCUPIED'::room_status
                                             ELSE 'AVAILABLE'::room_status END,
            housekeeping_status = CASE WHEN id = $3::uuid THEN housekeeping_status
                                       ELSE $4::housekeeping_status END,
            version = version + 1,
            updated_at = NOW(),
            updated_by = $5::uuid
      WHERE tenant_id = $1::uuid
        AND id = ANY($2::uuid[])`,
    [
      input.tenantId,
      [input.toRoomId, ...(input.fromRoomId ? [input.fromRoomId] : [])],
      input.toRoomId,
      input.fromHousekeepingStatus,
      input.actorId,
    ],
  );
};
