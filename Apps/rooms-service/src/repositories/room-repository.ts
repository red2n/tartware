/**
 * DEV DOC
 * Module: room-repository.ts
 * Purpose: Room reads and lifecycle writes backing the rooms REST surface.
 * Ownership: rooms-service (owner of the rooms table)
 *
 * Lifted verbatim out of `services/room-service.ts`, which keeps the mapping
 * and the business rules. Each function takes the same object the service
 * function receives, so the parameter expressions moved unchanged.
 */

import type { AmenityCatalogItem, RoomListRow, UpdateRoomInput } from "@tartware/schemas";

import { query } from "../lib/db.js";

/** Search window and filters for {@link selectAvailableRooms}. */
export type AvailableRoomSearchOptions = {
  tenantId: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: string;
  buildingId?: string;
  reservationId?: string;
  adults?: number;
};

/** Serialise a JSON column value, preserving an explicit null. */
const toJson = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
};

const UPDATE_ROOM_AND_RETURN_ROW_SQL = `
      WITH updated AS (
        UPDATE public.rooms r
        SET
          property_id = COALESCE($3, r.property_id),
          room_type_id = COALESCE($4, r.room_type_id),
          room_number = COALESCE($5, r.room_number),
          room_name = COALESCE($6, r.room_name),
          floor = COALESCE($7, r.floor),
          building = COALESCE($8, r.building),
          building_id = COALESCE($9, r.building_id),
          wing = COALESCE($10, r.wing),
          status = COALESCE($11, r.status),
          housekeeping_status = COALESCE($12, r.housekeeping_status),
          maintenance_status = COALESCE($13, r.maintenance_status),
          features = COALESCE($14, r.features),
          amenities = COALESCE($15, r.amenities),
          is_blocked = COALESCE($16, r.is_blocked),
          block_reason = COALESCE($17, r.block_reason),
          blocked_from = COALESCE($18, r.blocked_from),
          blocked_until = COALESCE($19, r.blocked_until),
          is_out_of_order = COALESCE($20, r.is_out_of_order),
          out_of_order_reason = COALESCE($21, r.out_of_order_reason),
          out_of_order_since = COALESCE($22, r.out_of_order_since),
          expected_ready_date = COALESCE($23, r.expected_ready_date),
          notes = COALESCE($24, r.notes),
          housekeeping_notes = COALESCE($25, r.housekeeping_notes),
          metadata = COALESCE($26, r.metadata),
          updated_at = CURRENT_TIMESTAMP,
          updated_by = COALESCE($27, r.updated_by),
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
        u.building_id,
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
    `;

const SOFT_DELETE_ROOM_SQL = `
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
    `;

const SELECT_AVAILABLE_ROOMS_SQL = `WITH group_holds AS (
       -- Rooms a group block is holding and has not yet picked up.
       --
       -- Until 2026-08-20 nothing subtracted these: a 40-room block for March
       -- left all 40 rooms sellable to anyone, and the rooming-list upload then
       -- logged "No available block for guest — creating reservation without
       -- block decrement" and created the reservation anyway, oversold. The
       -- block table even carries a GENERATED available_rooms column that no
       -- query read. See ui-gaps/16-booking-reference-data.md.
       --
       -- MAX across the nights in the window, not SUM: a stay needs one spare
       -- room on *every* night, so the tightest night is the constraint.
       -- release_unsold_rooms with a cutoff in the past releases the block
       -- back to general inventory, which is what a cutoff is for.
       SELECT grb.room_type_id,
              MAX(GREATEST(grb.blocked_rooms - COALESCE(grb.picked_rooms, 0), 0)) AS held_rooms
       FROM public.group_room_blocks grb
       JOIN public.group_bookings gb
         ON gb.group_booking_id = grb.group_booking_id
        AND gb.tenant_id = grb.tenant_id
       WHERE grb.tenant_id = $1::uuid
         AND gb.property_id = $2::uuid
         AND grb.block_date >= $3::date
         AND grb.block_date < $4::date
         AND grb.block_status IN ('pending', 'active')
         AND gb.block_status NOT IN ('cancelled', 'turndown', 'completed')
         AND COALESCE(grb.is_deleted, false) = false
         AND COALESCE(gb.is_deleted, false) = false
         AND NOT (
           COALESCE(gb.release_unsold_rooms, false) = true
           AND gb.cutoff_date IS NOT NULL
           AND gb.cutoff_date < CURRENT_DATE
         )
       GROUP BY grb.room_type_id
     ),
     allotment_holds AS (
       -- The same for contracted allotments. rooms_per_night when the block is
       -- an even nightly one, otherwise the whole block; rooms_available on
       -- the table is defined as blocked − picked, and the CHECK says so.
       --
       -- Only type-specific allotments are subtracted: an allotment with no
       -- room_type_id holds rooms of no particular type, and charging it
       -- against every type would over-hold the house several times over. That
       -- gap is recorded in ui-gaps/16 rather than guessed at here.
       SELECT a.room_type_id,
              SUM(GREATEST(
                COALESCE(a.rooms_per_night, a.total_rooms_blocked) - COALESCE(a.rooms_picked_up, 0),
                0
              )) AS held_rooms
       FROM public.allotments a
       WHERE a.tenant_id = $1::uuid
         AND a.property_id = $2::uuid
         AND a.room_type_id IS NOT NULL
         AND a.allotment_status IN ('TENTATIVE', 'DEFINITE', 'ACTIVE', 'PICKUP_IN_PROGRESS')
         AND a.start_date < $4::date
         AND a.end_date > $3::date
         AND (a.cutoff_date IS NULL OR a.cutoff_date >= CURRENT_DATE)
         AND COALESCE(a.is_deleted, false) = false
       GROUP BY a.room_type_id
     ),
     unassigned_reservations AS (
       -- Pre-aggregate unassigned reservation counts per room type.
       -- Excludes the current reservation ($10) so its own vacant slot is
       -- not hidden when the room picker is opened during check-in.
       SELECT ures.room_type_id, COUNT(ures.id) AS unassigned_count
       FROM public.reservations ures
       WHERE ures.tenant_id = $1::uuid
         AND ures.property_id = $2::uuid
         AND (ures.room_number IS NULL OR ures.room_number = '')
         AND ures.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
         AND ures.check_in_date < $4::date
         AND ures.check_out_date > $3::date
         AND ($10::uuid IS NULL OR ures.id != $10::uuid)
       GROUP BY ures.room_type_id
     ),
     available_rooms AS (
       SELECT
         r.id AS room_id, r.room_number, r.room_type_id,
         rt.type_name, r.floor, r.status, r.housekeeping_status,
         rt.max_occupancy, rt.bed_type, rt.number_of_beds, rt.size_sqm,
         COALESCE(rp.base_rate, rt.base_price, 0) AS base_rate,
         COALESCE(rp.currency, 'USD') AS currency,
         r.features,
         r.building_id,
         b.building_name,
         ROW_NUMBER() OVER (
           PARTITION BY r.room_type_id ORDER BY r.room_number
         ) AS rn
       FROM public.rooms r
       JOIN public.room_types rt ON r.room_type_id = rt.id AND rt.tenant_id = r.tenant_id
       LEFT JOIN public.buildings b ON r.building_id = b.building_id
       LEFT JOIN LATERAL (
         SELECT rp2.base_rate, rp2.currency
         FROM public.rates rp2
         WHERE rp2.tenant_id = r.tenant_id
           AND rp2.room_type_id = r.room_type_id
           AND rp2.status = 'ACTIVE'
           AND COALESCE(rp2.is_deleted, false) = false
         ORDER BY rp2.base_rate ASC
         LIMIT 1
       ) rp ON TRUE
       WHERE r.tenant_id = $1::uuid
         AND r.property_id = $2::uuid
         AND r.status = 'AVAILABLE'
         AND r.housekeeping_status IN ('CLEAN', 'INSPECTED')
         AND COALESCE(r.is_blocked, false) = false
         AND COALESCE(r.is_out_of_order, false) = false
         AND COALESCE(r.is_deleted, false) = false
         AND ($5::uuid IS NULL OR r.room_type_id = $5::uuid)
         AND ($6::int IS NULL OR rt.max_occupancy >= $6)
         AND ($7::uuid IS NULL OR r.building_id = $7::uuid)
         -- Exclude rooms with overlapping inventory locks
         AND NOT EXISTS (
           SELECT 1 FROM public.inventory_locks_shadow ils
           WHERE ils.room_id = r.id
             AND ils.tenant_id = r.tenant_id
             AND ils.status = 'ACTIVE'
             AND ils.stay_start < $4::date
             AND ils.stay_end > $3::date
         )
         -- Exclude rooms with overlapping active reservations (room assigned)
         AND NOT EXISTS (
           SELECT 1 FROM public.reservations res
           WHERE res.room_number = r.room_number
             AND res.tenant_id = r.tenant_id
             AND res.property_id = r.property_id
             AND res.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
             AND res.check_in_date < $4::date
             AND res.check_out_date > $3::date
         )
     )
     SELECT ar.room_id, ar.room_number, ar.room_type_id, ar.type_name, ar.floor,
            ar.building_id, ar.building_name,
            ar.status, ar.housekeeping_status, ar.max_occupancy, ar.bed_type,
            ar.number_of_beds, ar.size_sqm, ar.base_rate, ar.currency, ar.features
     FROM available_rooms ar
     LEFT JOIN unassigned_reservations ur ON ur.room_type_id = ar.room_type_id
     LEFT JOIN group_holds gh ON gh.room_type_id = ar.room_type_id
     LEFT JOIN allotment_holds ah ON ah.room_type_id = ar.room_type_id
     -- When a reservation_id is provided (check-in use case) bypass the unassigned guard.
     -- Staff manually picking a room for check-in need to see all physically available rooms;
     -- actual double-booking is prevented by the NOT EXISTS room_number conflict check above.
     -- For standard availability queries (no reservation_id), keep the guard to avoid overbooking.
     --
     -- Held block rooms are counted the same way as unassigned reservations: both
     -- are demand against a room *type* with no physical room attached yet, so
     -- both push the per-type row number the same way. Picking up a block writes
     -- reservations directly and never comes through here, so a group can still
     -- draw down its own block.
     WHERE (
       $10::uuid IS NOT NULL
       OR ar.rn > COALESCE(ur.unassigned_count, 0)
                + COALESCE(gh.held_rooms, 0)
                + COALESCE(ah.held_rooms, 0)
     )
     ORDER BY type_name, room_number
     LIMIT $8
     OFFSET $9`;

const COUNT_RATES_FOR_ROOM_TYPE_SQL = `
      SELECT COUNT(id)::text AS count
      FROM public.rates
      WHERE tenant_id = $1::uuid
        AND room_type_id = $2::uuid
        AND status = 'ACTIVE'
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    `;

const MARK_ROOM_AVAILABLE_SQL = `
      UPDATE public.rooms
      SET status = 'AVAILABLE',
          version = version + 1,
          updated_at = NOW(),
          updated_by = $3
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND status = 'SETUP'
        AND COALESCE(is_deleted, false) = false
    `;

const MARK_ROOM_IN_SETUP_SQL = `
      UPDATE public.rooms
      SET status = 'SETUP',
          version = version + 1,
          updated_at = NOW(),
          updated_by = $3
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND status = 'AVAILABLE'
        AND COALESCE(is_deleted, false) = false
    `;

const SELECT_AMENITY_CATALOG_SQL = `
      SELECT amenity_code, display_name, category, icon
      FROM public.room_amenity_catalog
      WHERE tenant_id = $1::uuid
        AND is_active = true
      ORDER BY sort_order, display_name
    `;

/**
 * Apply a partial room update and return the row as the list view sees it,
 * saving the caller a second read.
 */
export const updateRoomAndReturnRow = (input: UpdateRoomInput) =>
  query<RoomListRow>(UPDATE_ROOM_AND_RETURN_ROW_SQL, [
    input.room_id,
    input.tenant_id,
    input.property_id ?? null,
    input.room_type_id ?? null,
    input.room_number ?? null,
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
    input.updated_by ?? null,
  ]);

/**
 * Soft-delete a room, returning its id when a row was actually deleted.
 */
export const softDeleteRoom = (options: {
  tenant_id: string;
  room_id: string;
  deleted_by?: string;
}) =>
  query<{ id: string }>(SOFT_DELETE_ROOM_SQL, [
    options.room_id,
    options.tenant_id,
    options.deleted_by ?? null,
  ]);

/**
 * Rooms sellable across a stay window, excluding group holds, overlapping
 * reservations and rooms already spoken for.
 */
export const selectAvailableRooms = (
  options: AvailableRoomSearchOptions,
  limit: number,
  offset: number,
) =>
  query<{
    room_id: string;
    room_number: string;
    room_type_id: string;
    type_name: string;
    floor: string | null;
    building_id: string | null;
    building_name: string | null;
    status: string;
    housekeeping_status: string;
    max_occupancy: number | string | null;
    base_rate: number | string | null;
    currency: string | null;
    features: string | null;
    bed_type: string | null;
    number_of_beds: number | string | null;
    size_sqm: number | string | null;
  }>(SELECT_AVAILABLE_ROOMS_SQL, [
    options.tenantId,
    options.propertyId,
    options.checkInDate,
    options.checkOutDate,
    options.roomTypeId ?? null,
    options.adults ?? null,
    options.buildingId ?? null,
    limit,
    offset,
    options.reservationId ?? null,
  ]);

/**
 * How many rates exist for a room type — a room cannot go on sale without one.
 */
export const countRatesForRoomType = (
  input: { tenantId: string },
  room: { room_type_id?: string | null },
) => query<{ count: string }>(COUNT_RATES_FOR_ROOM_TYPE_SQL, [input.tenantId, room.room_type_id]);

/**
 * Return a room to sale.
 */
export const markRoomAvailable = (input: {
  tenantId: string;
  roomId: string;
  activatedBy?: string;
}) => query(MARK_ROOM_AVAILABLE_SQL, [input.tenantId, input.roomId, input.activatedBy ?? "SYSTEM"]);

/**
 * Take a room off sale and back into setup.
 */
export const markRoomInSetup = (input: {
  tenantId: string;
  roomId: string;
  deactivatedBy?: string;
}) =>
  query(MARK_ROOM_IN_SETUP_SQL, [input.tenantId, input.roomId, input.deactivatedBy ?? "SYSTEM"]);

/**
 * The tenant's amenity catalogue.
 */
export const selectAmenityCatalog = (tenantId: string) =>
  query<AmenityCatalogItem>(SELECT_AMENITY_CATALOG_SQL, [tenantId]);
