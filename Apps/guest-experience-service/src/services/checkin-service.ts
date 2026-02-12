import { randomUUID } from "node:crypto";

import {
  ReservationMobileCheckinCompleteCommandSchema,
  ReservationMobileCheckinStartCommandSchema,
} from "@tartware/schemas";

import { query, withTransaction } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { observeCheckinDuration, recordCheckinOutcome } from "../lib/metrics.js";

const logger = appLogger.child({ module: "checkin-service" });

type MobileCheckinRow = {
  mobile_checkin_id: string;
  tenant_id: string;
  property_id: string;
  reservation_id: string;
  guest_id: string;
  checkin_status: string;
  access_method: string;
  checkin_started_at: string | null;
  checkin_completed_at: string | null;
  room_id: string | null;
  digital_key_type: string | null;
  digital_key_id: string | null;
};

type ReservationRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  guest_id: string;
  confirmation_code: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  room_id: string | null;
};

const RESERVATION_LOOKUP_SQL = `
  SELECT
    r.id,
    r.tenant_id,
    r.property_id,
    r.guest_id,
    r.confirmation_code,
    r.status,
    r.check_in_date,
    r.check_out_date,
    r.room_id
  FROM reservations r
  WHERE r.id = $1
    AND r.tenant_id = $2
`;

const RESERVATION_BY_CONFIRMATION_SQL = `
  SELECT
    r.id,
    r.tenant_id,
    r.property_id,
    r.guest_id,
    r.confirmation_code,
    r.status,
    r.check_in_date,
    r.check_out_date,
    r.room_id
  FROM reservations r
  WHERE r.confirmation_code = $1
`;

const INSERT_MOBILE_CHECKIN_SQL = `
  INSERT INTO mobile_check_ins (
    mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
    checkin_status, access_method, device_type, app_version,
    checkin_started_at, created_by
  )
  VALUES ($1, $2, $3, $4, $5, 'in_progress', $6, $7, $8, NOW(), $9)
  ON CONFLICT (mobile_checkin_id) DO NOTHING
  RETURNING mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
            checkin_status, access_method, checkin_started_at, checkin_completed_at,
            room_id, digital_key_type, digital_key_id
`;

const GET_CHECKIN_SQL = `
  SELECT
    mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
    checkin_status, access_method, checkin_started_at, checkin_completed_at,
    room_id, digital_key_type, digital_key_id
  FROM mobile_check_ins
  WHERE mobile_checkin_id = $1
`;

const COMPLETE_CHECKIN_SQL = `
  UPDATE mobile_check_ins
  SET checkin_status = 'completed',
      checkin_completed_at = NOW(),
      identity_verification_method = $2,
      id_document_verified = $3,
      registration_card_signed = $4,
      payment_method_verified = $5,
      terms_accepted = $6,
      room_id = $7,
      digital_key_type = $8,
      updated_at = NOW()
  WHERE mobile_checkin_id = $1
    AND checkin_status IN ('in_progress', 'identity_verification', 'payment_verification', 'room_assignment')
  RETURNING mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
            checkin_status, access_method, checkin_started_at, checkin_completed_at,
            room_id, digital_key_type, digital_key_id
`;

export type StartCheckinInput = {
  reservationId: string;
  tenantId: string;
  guestId: string;
  accessMethod?: string;
  deviceType?: string;
  appVersion?: string;
  initiatedBy?: string | null;
};

export type StartCheckinResult = {
  mobileCheckinId: string;
  reservationId: string;
  status: string;
  accessMethod: string;
  startedAt: string | null;
};

/**
 * Start a mobile check-in flow.
 * Validates the reservation is in a valid status and the check-in date is within a ±1 day window.
 */
export const startMobileCheckin = async (input: StartCheckinInput): Promise<StartCheckinResult> => {
  const startTime = performance.now();
  try {
    const { rows: reservations } = await query<ReservationRow>(RESERVATION_LOOKUP_SQL, [
      input.reservationId,
      input.tenantId,
    ]);

    if (reservations.length === 0) {
      recordCheckinOutcome("start", "invalid");
      throw Object.assign(new Error("Reservation not found"), { statusCode: 404 });
    }

    const reservation = reservations[0]!;
    const validStatuses = ["CONFIRMED", "PENDING", "GUARANTEED"];
    if (!validStatuses.includes(reservation.status)) {
      recordCheckinOutcome("start", "invalid");
      throw Object.assign(
        new Error(`Reservation status '${reservation.status}' is not eligible for mobile check-in`),
        { statusCode: 409 },
      );
    }

    // Check-in date must be within ±1 day of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkinDate = new Date(reservation.check_in_date);
    checkinDate.setHours(0, 0, 0, 0);
    const dayDiff = Math.abs((checkinDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff > 1) {
      recordCheckinOutcome("start", "invalid");
      throw Object.assign(
        new Error("Check-in is only available within 1 day of the arrival date"),
        { statusCode: 422 },
      );
    }

    const mobileCheckinId = randomUUID();
    const { rows } = await query<MobileCheckinRow>(INSERT_MOBILE_CHECKIN_SQL, [
      mobileCheckinId,
      reservation.tenant_id,
      reservation.property_id,
      reservation.id,
      reservation.guest_id,
      input.accessMethod ?? "mobile_app",
      input.deviceType ?? null,
      input.appVersion ?? null,
      input.initiatedBy ?? null,
    ]);

    const row = rows[0];
    if (!row) {
      // Idempotency: ON CONFLICT DO NOTHING returns empty → already started
      recordCheckinOutcome("start", "success");
      return {
        mobileCheckinId,
        reservationId: input.reservationId,
        status: "in_progress",
        accessMethod: input.accessMethod ?? "mobile_app",
        startedAt: null,
      };
    }

    recordCheckinOutcome("start", "success");
    return {
      mobileCheckinId: row.mobile_checkin_id,
      reservationId: row.reservation_id,
      status: row.checkin_status,
      accessMethod: row.access_method,
      startedAt: row.checkin_started_at,
    };
  } catch (error) {
    if (!(error instanceof Error) || !(error as { statusCode?: number }).statusCode) {
      recordCheckinOutcome("start", "failed");
    }
    throw error;
  } finally {
    const durationSec = (performance.now() - startTime) / 1000;
    observeCheckinDuration("start", durationSec);
  }
};

export type CompleteCheckinInput = {
  mobileCheckinId: string;
  identityVerificationMethod?: string;
  idDocumentVerified?: boolean;
  registrationCardSigned?: boolean;
  paymentMethodVerified?: boolean;
  termsAccepted?: boolean;
  roomId?: string | null;
  digitalKeyType?: string | null;
  guestSignatureUrl?: string;
};

export type CompleteCheckinResult = {
  mobileCheckinId: string;
  reservationId: string;
  status: string;
  completedAt: string | null;
  roomId: string | null;
};

/**
 * Complete a mobile check-in flow. Marks the check-in as completed,
 * stores verification details, and optionally assigns room/key.
 */
export const completeMobileCheckin = async (
  input: CompleteCheckinInput,
): Promise<CompleteCheckinResult> => {
  const startTime = performance.now();
  try {
    const { rows: existing } = await query<MobileCheckinRow>(GET_CHECKIN_SQL, [
      input.mobileCheckinId,
    ]);
    if (existing.length === 0) {
      recordCheckinOutcome("complete", "invalid");
      throw Object.assign(new Error("Mobile check-in record not found"), { statusCode: 404 });
    }
    const existingCheckin = existing[0]!;
    if (existingCheckin.checkin_status === "completed") {
      recordCheckinOutcome("complete", "success");
      return {
        mobileCheckinId: existingCheckin.mobile_checkin_id,
        reservationId: existingCheckin.reservation_id,
        status: "completed",
        completedAt: existingCheckin.checkin_completed_at,
        roomId: existingCheckin.room_id,
      };
    }

    const { rows } = await query<MobileCheckinRow>(COMPLETE_CHECKIN_SQL, [
      input.mobileCheckinId,
      input.identityVerificationMethod ?? "existing_profile",
      input.idDocumentVerified ?? false,
      input.registrationCardSigned ?? false,
      input.paymentMethodVerified ?? false,
      input.termsAccepted ?? false,
      input.roomId ?? existingCheckin.room_id,
      input.digitalKeyType ?? null,
    ]);

    if (rows.length === 0) {
      recordCheckinOutcome("complete", "invalid");
      throw Object.assign(
        new Error("Check-in could not be completed — invalid status transition"),
        { statusCode: 409 },
      );
    }

    const row = rows[0]!;
    recordCheckinOutcome("complete", "success");
    logger.info(
      {
        mobileCheckinId: row.mobile_checkin_id,
        reservationId: row.reservation_id,
      },
      "mobile check-in completed",
    );

    return {
      mobileCheckinId: row.mobile_checkin_id,
      reservationId: row.reservation_id,
      status: row.checkin_status,
      completedAt: row.checkin_completed_at,
      roomId: row.room_id,
    };
  } catch (error) {
    if (!(error instanceof Error) || !(error as { statusCode?: number }).statusCode) {
      recordCheckinOutcome("complete", "failed");
    }
    throw error;
  } finally {
    const durationSec = (performance.now() - startTime) / 1000;
    observeCheckinDuration("complete", durationSec);
  }
};

/**
 * Look up a reservation by confirmation code.
 * Used for guest-facing authentication (not JWT).
 */
export const lookupReservationByConfirmation = async (
  confirmationCode: string,
): Promise<ReservationRow | null> => {
  const { rows } = await query<ReservationRow>(RESERVATION_BY_CONFIRMATION_SQL, [confirmationCode]);
  return rows[0] ?? null;
};

/**
 * Get a mobile check-in record by ID.
 */
export const getCheckinById = async (mobileCheckinId: string): Promise<MobileCheckinRow | null> => {
  const { rows } = await query<MobileCheckinRow>(GET_CHECKIN_SQL, [mobileCheckinId]);
  return rows[0] ?? null;
};
