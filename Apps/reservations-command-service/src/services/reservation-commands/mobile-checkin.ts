import { v4 as uuid } from "uuid";

import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import type {
  ReservationGenerateRegCardCommand,
  ReservationMobileCheckinCompleteCommand,
  ReservationMobileCheckinStartCommand,
} from "../../schemas/reservation-command.js";
import {
  ReservationCommandError,
  type CreateReservationResult,
  SYSTEM_ACTOR_ID,
} from "./common.js";

// ─── S27: Digital Registration Cards ─────────────────────────────────────────

/**
 * Generate a digital registration card for a reservation.
 * Snapshots guest data and reservation details into the
 * digital_registration_cards table for legal/compliance purposes.
 */
export const generateRegistrationCard = async (
  tenantId: string,
  command: ReservationGenerateRegCardCommand,
  _context?: { correlationId?: string },
): Promise<{ eventId: string; status: string }> => {
  // 1. Fetch reservation + guest data
  const { rows: resRows } = await query<Record<string, unknown>>(
    `SELECT r.id, r.guest_id, r.room_type_id, r.room_number,
            r.check_in_date, r.check_out_date, r.number_of_adults, r.number_of_children,
            r.rate_code, r.status,
            g.first_name, g.last_name, g.email, g.phone, g.date_of_birth,
            g.nationality, g.id_type, g.id_number, g.id_issuing_country,
            g.id_issue_date, g.id_expiry_date,
            g.address_line1, g.address_city, g.address_state,
            g.address_country, g.address_postal_code,
            rt.name AS room_type_name
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id
     LEFT JOIN room_types rt ON rt.id = r.room_type_id AND rt.tenant_id = r.tenant_id
     WHERE r.id = $1 AND r.tenant_id = $2`,
    [command.reservation_id, tenantId],
  );
  const res = resRows[0];
  if (!res) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  // 2. Generate registration number: REG-YYYYMMDD-XXXX
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { rows: countRows } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::int AS cnt FROM digital_registration_cards
     WHERE tenant_id = $1 AND property_id = $2 AND registration_date = CURRENT_DATE`,
    [tenantId, command.property_id],
  );
  const seq = (Number(countRows[0]?.cnt ?? 0) + 1).toString().padStart(4, "0");
  const registrationNumber = `REG-${today}-${seq}`;
  const registrationId = uuid();

  // 3. Compute nights
  const arrivalDate = new Date(res.check_in_date as string);
  const departureDate = new Date(res.check_out_date as string);
  const nights = Math.max(
    1,
    Math.round((departureDate.getTime() - arrivalDate.getTime()) / 86400000),
  );

  const guestFullName = `${res.first_name ?? ""} ${res.last_name ?? ""}`.trim();

  // 4. Insert registration card (idempotent: ON CONFLICT skip)
  await query(
    `INSERT INTO digital_registration_cards (
       registration_id, tenant_id, property_id, reservation_id, guest_id,
       registration_number, registration_date, registration_time,
       guest_full_name, guest_email, guest_phone, guest_date_of_birth, guest_nationality,
       id_type, id_number, id_issuing_country, id_issue_date, id_expiry_date,
       home_address, home_city, home_state, home_country, home_postal_code,
       arrival_date, departure_date, number_of_nights,
       number_of_adults, number_of_children,
       room_number, room_type, rate_code,
       companion_names, companion_count,
       vehicle_license_plate, vehicle_make, vehicle_model, vehicle_color,
       visit_purpose, company_name,
       emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
       terms_accepted, privacy_accepted, marketing_consent,
       special_notes,
       regulatory_compliance_status,
       created_at, created_by
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, CURRENT_DATE, CURRENT_TIME,
       $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16,
       $17, $18, $19, $20, $21,
       $22, $23, $24,
       $25, $26,
       $27, $28, $29,
       $30, $31,
       $32, $33, $34, $35,
       $36, $37,
       $38, $39, $40,
       $41, $42, $43,
       $44,
       'pending',
       NOW(), $5
     )
     ON CONFLICT (registration_number) DO NOTHING`,
    [
      registrationId,
      tenantId,
      command.property_id,
      command.reservation_id,
      res.guest_id,
      registrationNumber,
      guestFullName,
      res.email,
      res.phone,
      res.date_of_birth,
      res.nationality,
      res.id_type,
      res.id_number,
      res.id_issuing_country,
      res.id_issue_date,
      res.id_expiry_date,
      res.address_line1,
      res.address_city,
      res.address_state,
      res.address_country,
      res.address_postal_code,
      res.check_in_date,
      res.check_out_date,
      nights,
      res.number_of_adults ?? 1,
      res.number_of_children ?? 0,
      res.room_number ?? null,
      res.room_type_name ?? null,
      res.rate_code ?? null,
      command.companion_names ?? null,
      command.companion_names?.length ?? 0,
      command.vehicle_license_plate ?? null,
      command.vehicle_make ?? null,
      command.vehicle_model ?? null,
      command.vehicle_color ?? null,
      command.visit_purpose ?? "leisure",
      command.company_name ?? null,
      command.emergency_contact_name ?? null,
      command.emergency_contact_phone ?? null,
      command.emergency_contact_relationship ?? null,
      command.terms_accepted,
      command.privacy_accepted,
      command.marketing_consent,
      command.special_notes ?? null,
    ],
  );

  reservationsLogger.info(
    { registrationId, registrationNumber, reservationId: command.reservation_id },
    "Digital registration card generated",
  );

  return { eventId: registrationId, status: "generated" };
};

// ─── S17: Mobile Check-in ───────────────────────────────────────────────────

/**
 * Start a mobile check-in flow. Creates a mobile_check_ins row
 * in "in_progress" status and records device/access info.
 */
export const startMobileCheckin = async (
  tenantId: string,
  command: ReservationMobileCheckinStartCommand,
  _context?: { correlationId?: string },
): Promise<{ eventId: string; status: string }> => {
  // 1. Verify reservation exists and is eligible for check-in
  const { rows: resRows } = await query<Record<string, unknown>>(
    `SELECT id, status, room_id, room_number, check_in_date
     FROM reservations WHERE id = $1 AND tenant_id = $2`,
    [command.reservation_id, tenantId],
  );
  const res = resRows[0];
  if (!res) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }
  const allowedStatuses = ["CONFIRMED", "PENDING", "GUARANTEED"];
  if (!allowedStatuses.includes(res.status as string)) {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_MOBILE_CHECKIN",
      `Reservation status ${res.status} is not eligible for mobile check-in`,
    );
  }

  const checkinId = uuid();

  // 2. Insert mobile_check_ins row (idempotent per reservation)
  await query(
    `INSERT INTO mobile_check_ins (
       mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
       checkin_status, access_method,
       device_type, device_os, app_version,
       started_at,
       created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       'in_progress', $6,
       $7, $8, $9,
       NOW(),
       NOW(), NOW()
     )
     ON CONFLICT (reservation_id) WHERE is_deleted = false DO UPDATE
       SET checkin_status = 'in_progress', updated_at = NOW()
     RETURNING mobile_checkin_id`,
    [
      checkinId,
      tenantId,
      command.property_id,
      command.reservation_id,
      command.guest_id,
      command.access_method,
      command.device_type ?? null,
      command.device_os ?? null,
      command.app_version ?? null,
    ],
  );

  reservationsLogger.info(
    { checkinId, reservationId: command.reservation_id, guestId: command.guest_id },
    "Mobile check-in started",
  );

  return { eventId: checkinId, status: "in_progress" };
};

/**
 * Complete a mobile check-in flow. Verifies identity and payment,
 * optionally assigns a room and generates a digital key, then
 * transitions the check-in status to "completed" and actually
 * performs the reservation check-in.
 */
export const completeMobileCheckin = async (
  tenantId: string,
  command: ReservationMobileCheckinCompleteCommand,
  _context?: { correlationId?: string },
): Promise<{ eventId: string; status: string }> => {
  // 1. Verify mobile_check_ins row exists and is in_progress
  const { rows: checkinRows } = await query<Record<string, unknown>>(
    `SELECT mobile_checkin_id, reservation_id, guest_id, property_id, checkin_status
     FROM mobile_check_ins
     WHERE mobile_checkin_id = $1 AND tenant_id = $2 AND is_deleted = false`,
    [command.mobile_checkin_id, tenantId],
  );
  const checkin = checkinRows[0];
  if (!checkin) {
    throw new ReservationCommandError(
      "MOBILE_CHECKIN_NOT_FOUND",
      `Mobile check-in ${command.mobile_checkin_id} not found`,
    );
  }
  if (
    checkin.checkin_status !== "in_progress" &&
    checkin.checkin_status !== "identity_verification"
  ) {
    throw new ReservationCommandError(
      "INVALID_CHECKIN_STATUS",
      `Mobile check-in status is ${checkin.checkin_status}, cannot complete`,
    );
  }

  // 2. Generate digital key if key type specified
  let digitalKeyGenerated = false;
  let keyCode: string | null = null;
  if (command.digital_key_type && command.room_id) {
    keyCode = `MK-${uuid().slice(0, 12).toUpperCase()}`;
    const keyId = uuid();
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 7); // 7-day key validity

    await query(
      `INSERT INTO mobile_keys (
         key_id, tenant_id, property_id, guest_id, reservation_id, room_id,
         key_code, key_type, status,
         valid_from, valid_to,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, 'active',
         $9, $10,
         NOW(), NOW()
       )
       ON CONFLICT (key_code) DO NOTHING`,
      [
        keyId,
        tenantId,
        checkin.property_id,
        checkin.guest_id,
        checkin.reservation_id,
        command.room_id,
        keyCode,
        command.digital_key_type,
        validFrom.toISOString(),
        validTo.toISOString(),
      ],
    );
    digitalKeyGenerated = true;
  }

  // 3. Update mobile_check_ins with completion data
  await query(
    `UPDATE mobile_check_ins SET
       checkin_status = 'completed',
       identity_verification_method = $3,
       id_document_verified = $4,
       registration_card_signed = $5,
       payment_method_verified = $6,
       guest_signature_url = $7,
       room_assigned = $8,
       digital_key_generated = $9,
       digital_key_type = $10,
       terms_accepted = $11,
       completed_at = NOW(),
       updated_at = NOW()
     WHERE mobile_checkin_id = $1 AND tenant_id = $2`,
    [
      command.mobile_checkin_id,
      tenantId,
      command.identity_verification_method,
      command.id_document_verified,
      command.registration_card_signed,
      command.payment_method_verified,
      command.guest_signature_url ?? null,
      command.room_id ? true : false,
      digitalKeyGenerated,
      command.digital_key_type ?? null,
      command.terms_accepted,
    ],
  );

  // 4. Check in the reservation itself (update status to CHECKED_IN)
  await query(
    `UPDATE reservations SET
       status = 'CHECKED_IN',
       actual_check_in = NOW(),
       room_id = COALESCE($3, room_id),
       version = version + 1,
       updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
       AND status IN ('CONFIRMED', 'PENDING', 'GUARANTEED')`,
    [checkin.reservation_id, tenantId, command.room_id ?? null],
  );

  reservationsLogger.info(
    {
      checkinId: command.mobile_checkin_id,
      reservationId: checkin.reservation_id,
      digitalKeyGenerated,
      keyCode,
    },
    "Mobile check-in completed",
  );

  return { eventId: command.mobile_checkin_id, status: "completed" };
};
