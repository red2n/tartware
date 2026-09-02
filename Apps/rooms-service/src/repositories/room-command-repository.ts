/**
 * DEV DOC
 * Module: room-command-repository.ts
 * Purpose: Every statement the room command handlers issue — room state, room
 *          moves, mobile keys and blocks.
 * Ownership: rooms-service (owner of the rooms and mobile_keys tables)
 *
 * Lifted verbatim out of `services/room-command-service.ts`, which is now
 * orchestration: validate, decide, call one of these, publish.
 */

import { query } from "../lib/db.js";

const UPDATE_ROOM_STATUS_SQL = `
      UPDATE public.rooms
      SET
        status = COALESCE($3::room_status, status),
        maintenance_status = COALESCE($4::maintenance_status, maintenance_status),
        is_blocked = CASE
          WHEN $3::room_status = 'AVAILABLE' THEN false
          ELSE is_blocked
        END,
        is_out_of_order = CASE
          WHEN $3::room_status = 'AVAILABLE' THEN false
          WHEN $3::room_status IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE') THEN true
          ELSE is_out_of_order
        END,
        out_of_order_reason = CASE
          WHEN $3::room_status = 'AVAILABLE' THEN NULL
          ELSE out_of_order_reason
        END,
        notes = CASE
          WHEN $5::text IS NULL THEN notes
          WHEN notes IS NULL THEN $5::text
          ELSE CONCAT_WS(E'\\n', notes, $5::text)
        END,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const FIND_ROOM_NUMBER_SQL = `SELECT room_number FROM public.rooms WHERE id = $1 AND tenant_id = $2::uuid LIMIT 1`;

const UPDATE_HOUSEKEEPING_STATUS_SQL = `
      UPDATE public.rooms
      SET
        housekeeping_status = $3::housekeeping_status,
        housekeeping_notes = CASE
          WHEN $4::text IS NULL THEN housekeeping_notes
          WHEN housekeeping_notes IS NULL THEN $4::text
          ELSE CONCAT_WS(E'\\n', housekeeping_notes, $4::text)
        END,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const MARK_ROOM_OUT_OF_ORDER_SQL = `
      UPDATE public.rooms
      SET
        status = 'OUT_OF_ORDER',
        is_out_of_order = true,
        out_of_order_reason = $3,
        out_of_order_since = COALESCE($4, NOW()),
        expected_ready_date = $5,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const MARK_ROOM_OUT_OF_SERVICE_SQL = `
      UPDATE public.rooms
      SET
        status = 'OUT_OF_SERVICE',
        is_out_of_order = true,
        out_of_order_reason = $3,
        out_of_order_since = COALESCE($4, NOW()),
        expected_ready_date = $5,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const FIND_ROOM_FOR_MOVE_SQL = `SELECT id, status, room_number, room_type_id FROM public.rooms
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`;

const MARK_ROOM_DIRTY_SQL = `UPDATE public.rooms SET status = 'DIRTY', version = version + 1, updated_at = NOW(), updated_by = $3
     WHERE id = $1 AND tenant_id = $2`;

const MARK_ROOM_OCCUPIED_SQL = `UPDATE public.rooms SET status = 'OCCUPIED', version = version + 1, updated_at = NOW(), updated_by = $3
     WHERE id = $1 AND tenant_id = $2`;

const ASSIGN_RESERVATION_ROOM_AND_TYPE_SQL = `UPDATE public.reservations
         SET room_number = $3, room_type_id = $4, version = version + 1, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`;

const ASSIGN_RESERVATION_ROOM_SQL = `UPDATE public.reservations
         SET room_number = $3, version = version + 1, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`;

const FIND_ROOM_TYPE_BASE_PRICE_SQL = `SELECT base_price FROM public.room_types
         WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`;

const UPDATE_RESERVATION_RATE_SQL = `UPDATE public.reservations
           SET room_rate = $3,
               total_amount = $3 * GREATEST(1, check_out_date::date - check_in_date::date),
               version = version + 1, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`;

const FETCH_RATE_CHANGE_CONTEXT_SQL = `SELECT GREATEST(0, check_out_date::date - CURRENT_DATE) AS remaining_nights,
                      property_id
               FROM public.reservations
               WHERE id = $1 AND tenant_id = $2`;

const TRANSFER_ROOM_CHARGES_SQL = `UPDATE public.charge_postings
         SET transfer_from_folio_id = folio_id,
             transfer_to_folio_id = (
               SELECT folio_id FROM public.folios
               WHERE reservation_id = $3 AND tenant_id = $1
                 AND folio_status = 'OPEN'
               ORDER BY created_at ASC LIMIT 1
             ),
             updated_at = NOW()
         WHERE tenant_id = $1
           AND reservation_id = $3
           AND is_voided = false
           AND transfer_from_folio_id IS NULL`;

const RECORD_ROOM_MOVE_HISTORY_SQL = `INSERT INTO public.reservation_status_history
         (reservation_id, tenant_id, previous_status, new_status, change_reason, changed_by, changed_at, metadata)
       VALUES ($1, $2, 'CHECKED_IN', 'CHECKED_IN', $3, $4, NOW(), $5)`;

const FIND_RESERVATION_FOR_NOTIFICATION_SQL = `SELECT guest_id, property_id, confirmation_number
         FROM public.reservations
         WHERE id = $1 AND tenant_id = $2::uuid
         LIMIT 1`;

const FIND_GUEST_CONTACT_SQL = `SELECT COALESCE(first_name || ' ' || last_name, 'Guest') AS guest_name, email
           FROM public.guests
           WHERE id = $1 AND tenant_id = $2::uuid
           LIMIT 1`;

const UPDATE_ROOM_FEATURES_SQL = `
      UPDATE public.rooms
      SET
        features = COALESCE($3::jsonb, features),
        amenities = COALESCE($4::jsonb, amenities),
        notes = CASE
          WHEN $5 IS NULL THEN notes
          WHEN notes IS NULL THEN $5
          ELSE CONCAT_WS(E'\\n', notes, $5)
        END,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $6
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

const FIND_ROOM_FOR_KEY_ISSUE_SQL = `SELECT id, room_number FROM public.rooms
     WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`;

const INSERT_MOBILE_KEY_SQL = `INSERT INTO public.mobile_keys (
       tenant_id, property_id, guest_id, reservation_id, room_id,
       key_code, key_type, status,
       valid_from, valid_to, usage_count,
       device_id, device_type, metadata,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, 'active',
       $8, $9, 0,
       $10, $11, $12,
       $13, $13
     )
     ON CONFLICT (key_code) DO NOTHING`;

const REVOKE_KEYS_FOR_RESERVATION_SQL = `UPDATE public.mobile_keys
       SET status = 'revoked', updated_at = NOW(), updated_by = $3,
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('revoke_reason', $4)
       WHERE tenant_id = $1 AND reservation_id = $2
         AND status = 'active'
         AND COALESCE(is_deleted, false) = false`;

const REVOKE_KEY_SQL = `UPDATE public.mobile_keys
     SET status = 'revoked', updated_at = NOW(), updated_by = $3,
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('revoke_reason', $4)
     WHERE tenant_id = $1 AND key_id = $2
       AND status = 'active'
       AND COALESCE(is_deleted, false) = false`;

const APPLY_ROOM_BLOCK_SQL = `
      UPDATE public.rooms
      SET
        is_blocked = TRUE,
        status = 'BLOCKED',
        block_reason = COALESCE($3, block_reason),
        blocked_from = $4,
        blocked_until = $5,
        expected_ready_date = $6,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $7
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      `;

const UNBLOCK_ROOM_SQL = `
      UPDATE public.rooms
      SET
        is_blocked = FALSE,
        status = CASE
          WHEN is_out_of_order = true THEN status
          ELSE 'AVAILABLE'
        END,
        block_reason = NULL,
        blocked_from = NULL,
        blocked_until = NULL,
        expected_ready_date = NULL,
        version = version + 1,
        updated_at = NOW(),
        updated_by = $3
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
    `;

/**
 * Apply a status change, keeping is_blocked / is_out_of_order in step so room
 * availability has a single source of truth. Appends `note` to existing notes.
 */
export const updateRoomStatus = (
  tenantId: string,
  roomId: string,
  status: string | null,
  maintenanceStatus: string | null,
  note: string | null,
  actorId: string,
) => query(UPDATE_ROOM_STATUS_SQL, [tenantId, roomId, status, maintenanceStatus, note, actorId]);

/**
 * Look up a room's display number.
 */
export const findRoomNumber = (roomId: string, tenantId: string) =>
  query<{ room_number: string }>(FIND_ROOM_NUMBER_SQL, [roomId, tenantId]);

/**
 * Set the housekeeping status, appending any note to the existing ones.
 */
export const updateHousekeepingStatus = (
  tenantId: string,
  roomId: string,
  housekeepingStatus: string,
  notes: string | null,
  actorId: string,
) => query(UPDATE_HOUSEKEEPING_STATUS_SQL, [tenantId, roomId, housekeepingStatus, notes, actorId]);

/**
 * Take a room out of order — unsellable and excluded from inventory.
 */
export const markRoomOutOfOrder = (
  tenantId: string,
  roomId: string,
  reason: string | null,
  since: Date | string | null,
  expectedReadyDate: Date | string | null,
  actorId: string,
) =>
  query(MARK_ROOM_OUT_OF_ORDER_SQL, [tenantId, roomId, reason, since, expectedReadyDate, actorId]);

/**
 * Take a room out of service for a bounded window.
 */
export const markRoomOutOfService = (
  tenantId: string,
  roomId: string,
  reason: string | null,
  from: Date | string | null,
  until: Date | string | null,
  actorId: string,
) => query(MARK_ROOM_OUT_OF_SERVICE_SQL, [tenantId, roomId, reason, from, until, actorId]);

/**
 * Fetch the identity and type a room move needs from either side of the move.
 */
export const findRoomForMove = (roomId: string, tenantId: string) =>
  query<{
    id: string;
    status: string;
    room_number: string;
    room_type_id: string;
  }>(FIND_ROOM_FOR_MOVE_SQL, [roomId, tenantId]);

/**
 * Mark the room a guest moved out of as dirty.
 */
export const markRoomDirty = (roomId: string, tenantId: string, actorId: string) =>
  query(MARK_ROOM_DIRTY_SQL, [roomId, tenantId, actorId]);

/**
 * Mark the room a guest moved into as occupied.
 */
export const markRoomOccupied = (roomId: string, tenantId: string, actorId: string) =>
  query(MARK_ROOM_OCCUPIED_SQL, [roomId, tenantId, actorId]);

/**
 * Point a reservation at a new room whose type also changed.
 */
export const assignReservationRoomAndType = (
  reservationId: string,
  tenantId: string,
  roomNumber: string,
  roomTypeId: string,
) => query(ASSIGN_RESERVATION_ROOM_AND_TYPE_SQL, [reservationId, tenantId, roomNumber, roomTypeId]);

/**
 * Point a reservation at a new room of the same type.
 */
export const assignReservationRoom = (
  reservationId: string,
  tenantId: string,
  roomNumber: string,
) => query(ASSIGN_RESERVATION_ROOM_SQL, [reservationId, tenantId, roomNumber]);

/**
 * Base price for a room type, used to re-rate a cross-type move.
 */
export const findRoomTypeBasePrice = (roomTypeId: string, tenantId: string) =>
  query<{ base_price: string | number }>(FIND_ROOM_TYPE_BASE_PRICE_SQL, [roomTypeId, tenantId]);

/**
 * Re-rate a reservation and recompute its total across the remaining nights.
 */
export const updateReservationRate = (reservationId: string, tenantId: string, rate: number) =>
  query(UPDATE_RESERVATION_RATE_SQL, [reservationId, tenantId, rate]);

/**
 * Remaining nights and rate context for a mid-stay room move.
 */
export const fetchRateChangeContext = (reservationId: string, tenantId: string) =>
  query<{
    remaining_nights: number;
    property_id: string;
  }>(FETCH_RATE_CHANGE_CONTEXT_SQL, [reservationId, tenantId]);

/**
 * Move outstanding charges from the old room's folio to the new one.
 */
export const transferRoomCharges = (tenantId: string, fromRoomId: string, reservationId: string) =>
  query(TRANSFER_ROOM_CHARGES_SQL, [tenantId, fromRoomId, reservationId]);

/**
 * Append the move to the reservation's status history.
 */
export const recordRoomMoveHistory = (
  reservationId: string,
  tenantId: string,
  changeReason: string,
  actorId: string,
  metadata: string,
) =>
  query(RECORD_ROOM_MOVE_HISTORY_SQL, [reservationId, tenantId, changeReason, actorId, metadata]);

/**
 * Guest and property identifiers needed to notify about a move.
 */
export const findReservationForNotification = (reservationId: string, tenantId: string) =>
  query<{
    guest_id: string;
    property_id: string;
    confirmation_number: string;
  }>(FIND_RESERVATION_FOR_NOTIFICATION_SQL, [reservationId, tenantId]);

/**
 * Guest display name and contact details for a notification.
 */
export const findGuestContact = (guestId: string, tenantId: string) =>
  query<{
    guest_name: string;
    email: string | null;
  }>(FIND_GUEST_CONTACT_SQL, [guestId, tenantId]);

/**
 * Replace a room's feature and amenity sets.
 */
export const updateRoomFeatures = (
  tenantId: string,
  roomId: string,
  features: string | null,
  amenities: string | null,
  notes: string | null,
  actorId: string,
) => query(UPDATE_ROOM_FEATURES_SQL, [tenantId, roomId, features, amenities, notes, actorId]);

/**
 * Confirm a room exists and belongs to the tenant before issuing a key.
 */
export const findRoomForKeyIssue = (roomId: string, tenantId: string) =>
  query<{ id: string; room_number: string }>(FIND_ROOM_FOR_KEY_ISSUE_SQL, [roomId, tenantId]);

/**
 * Issue a mobile key. ON CONFLICT DO NOTHING makes a duplicate key code a no-op.
 */
export const insertMobileKey = (
  tenantId: string,
  propertyId: string,
  guestId: string,
  reservationId: string,
  roomId: string,
  keyCode: string,
  keyType: string,
  validFrom: Date,
  validTo: Date,
  deviceId: string | null,
  deviceType: string | null,
  metadata: string | null,
  actorId: string,
) =>
  query(INSERT_MOBILE_KEY_SQL, [
    tenantId,
    propertyId,
    guestId,
    reservationId,
    roomId,
    keyCode,
    keyType,
    validFrom,
    validTo,
    deviceId,
    deviceType,
    metadata,
    actorId,
  ]);

/**
 * Revoke every active key for a reservation — used at check-out.
 */
export const revokeKeysForReservation = (
  tenantId: string,
  reservationId: string,
  actorId: string,
  reason: string,
) => query(REVOKE_KEYS_FOR_RESERVATION_SQL, [tenantId, reservationId, actorId, reason]);

/**
 * Revoke a single mobile key.
 */
export const revokeKey = (tenantId: string, keyId: string, actorId: string, reason: string) =>
  query(REVOKE_KEY_SQL, [tenantId, keyId, actorId, reason]);

/**
 * Block a room from sale for a date window.
 */
export const applyRoomBlock = (
  tenantId: string,
  roomId: string,
  reason: string | null,
  blockedFrom: Date | string,
  blockedUntil: Date | string | null,
  expectedReadyDate: Date | string | null,
  actorId: string,
) =>
  query(APPLY_ROOM_BLOCK_SQL, [
    tenantId,
    roomId,
    reason,
    blockedFrom,
    blockedUntil,
    expectedReadyDate,
    actorId,
  ]);

/**
 * Return a blocked room to sale, unless it is also out of order.
 */
export const unblockRoom = (tenantId: string, roomId: string, actorId: string) =>
  query(UNBLOCK_ROOM_SQL, [tenantId, roomId, actorId]);
