/**
 * DEV DOC
 * Module: sql/room-occupancy.ts
 * Purpose: The one definition of "this physical room is held for some night of
 *          this window", shared by every availability read in the service.
 * Ownership: rooms-service
 *
 * Five queries used to answer this question five slightly different ways, all
 * of them by matching `reservations.room_number` as a string against the room.
 * That was wrong in two directions once a booking could hold more than one
 * room: `reservations` carries a single room number, so rooms 2..n of a
 * booking looked free and could be sold twice; and the window was compared
 * against the reservation's own dates rather than the nights it actually
 * holds, so an extended or shortened stay took effect late.
 *
 * The occupancy grain is `reservation_rooms` joined to `reservation_nights`:
 * one row per room per night, which is exactly the question being asked.
 */

/** Reservation statuses that hold inventory. */
const HOLDING_STATUSES = "'PENDING', 'CONFIRMED', 'CHECKED_IN'";

/** Room-level statuses that hold inventory. */
const HOLDING_ROOM_STATUSES = "'PENDING', 'CONFIRMED', 'CHECKED_IN'";

/**
 * A `NOT EXISTS (…)` clause excluding rooms held for any night in
 * `[fromParam, toParam)`.
 *
 * `roomAlias` is the alias of the `rooms` row in the caller's query;
 * `fromParam` / `toParam` are the caller's own placeholders (`"$3"`, `"$4"`),
 * so the fragment binds no values of its own and adds no parameters.
 *
 * A room row that has not been allocated a `room_id` yet still blocks its
 * room number, which is how a stay assigned before this table existed keeps
 * holding its room.
 */
export const roomNotHeldForWindow = (
  roomAlias: string,
  fromParam: string,
  toParam: string,
): string => `NOT EXISTS (
          SELECT 1
          FROM public.reservation_rooms rr
          JOIN public.reservations res
            ON res.id = rr.reservation_id AND res.tenant_id = rr.tenant_id
          WHERE rr.tenant_id = ${roomAlias}.tenant_id
            AND rr.property_id = ${roomAlias}.property_id
            AND COALESCE(rr.is_deleted, false) = false
            AND rr.status IN (${HOLDING_ROOM_STATUSES})
            AND res.status IN (${HOLDING_STATUSES})
            AND COALESCE(res.is_deleted, false) = false
            AND (
              rr.room_id = ${roomAlias}.id
              OR (rr.room_id IS NULL AND rr.room_number = ${roomAlias}.room_number)
            )
            AND EXISTS (
              SELECT 1 FROM public.reservation_nights n
              WHERE n.reservation_room_id = rr.reservation_room_id
                AND COALESCE(n.is_deleted, false) = false
                AND n.stay_date >= ${fromParam}::date
                AND n.stay_date < ${toParam}::date
            )
        )`;

/**
 * Rooms of a type that are sold but not yet allocated to a specific room, for
 * any night in `[fromParam, toParam)` — the count a room picker has to hold
 * back so it does not hand out a room that is already spoken for.
 *
 * `excludeReservationParam` drops the reservation being worked on, so its own
 * unallocated room does not hide the slot it is about to take.
 */
export const unassignedRoomNightsByType = (
  tenantParam: string,
  propertyParam: string,
  fromParam: string,
  toParam: string,
  excludeReservationParam: string,
): string => `SELECT rr.room_type_id,
              COUNT(DISTINCT rr.reservation_room_id) AS unassigned_count
       FROM public.reservation_rooms rr
       JOIN public.reservations res
         ON res.id = rr.reservation_id AND res.tenant_id = rr.tenant_id
       WHERE rr.tenant_id = ${tenantParam}::uuid
         AND rr.property_id = ${propertyParam}::uuid
         AND rr.room_id IS NULL
         AND (rr.room_number IS NULL OR rr.room_number = '')
         AND COALESCE(rr.is_deleted, false) = false
         AND rr.status IN (${HOLDING_ROOM_STATUSES})
         AND res.status IN (${HOLDING_STATUSES})
         AND COALESCE(res.is_deleted, false) = false
         AND (${excludeReservationParam}::uuid IS NULL OR rr.reservation_id != ${excludeReservationParam}::uuid)
         AND EXISTS (
           SELECT 1 FROM public.reservation_nights n
           WHERE n.reservation_room_id = rr.reservation_room_id
             AND COALESCE(n.is_deleted, false) = false
             AND n.stay_date >= ${fromParam}::date
             AND n.stay_date < ${toParam}::date
         )
       GROUP BY rr.room_type_id`;
