import { randomUUID } from "node:crypto";

import type {
  CompleteCheckinInput,
  CompleteCheckinResult,
  MobileCheckinRow,
  ReservationBriefRow,
  StartCheckinInput,
  StartCheckinResult,
} from "@tartware/schemas";

import { config } from "../config.js";
import { query } from "../lib/db.js";
import { internalGet } from "../lib/internal-api.js";
import { appLogger } from "../lib/logger.js";
import { observeCheckinDuration, recordCheckinOutcome } from "../lib/metrics.js";
import {
  COMPLETE_CHECKIN_SQL,
  GET_CHECKIN_SQL,
  INSERT_MOBILE_CHECKIN_SQL,
  RESERVATION_BY_CONFIRMATION_SQL,
} from "../repositories/checkin-repository.js";

const logger = appLogger.child({ module: "checkin-service" });

/**
 * Start a mobile check-in flow.
 * Validates the reservation is in a valid status and the check-in date is within a ±1 day window.
 */
export const startMobileCheckin = async (input: StartCheckinInput): Promise<StartCheckinResult> => {
  const startTime = performance.now();
  try {
    // Look up reservation via core-service
    let reservation: ReservationBriefRow;
    try {
      reservation = await internalGet<ReservationBriefRow>(
        config.internalServices.coreServiceUrl,
        `/v1/reservations/${input.reservationId}`,
        { tenant_id: input.tenantId },
      );
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        recordCheckinOutcome("start", "invalid");
        throw Object.assign(new Error("Reservation not found"), { statusCode: 404 });
      }
      throw error;
    }

    const validStatuses = ["confirmed", "pending"];
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
    const existingCheckin = existing[0] as NonNullable<(typeof existing)[0]>;
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

    // Industry-standard preconditions for completing a check-in (PCI + identity).
    // Both must be explicitly true; default-false coercion below is intentional.
    if (!input.idDocumentVerified) {
      recordCheckinOutcome("complete", "invalid");
      throw Object.assign(
        new Error("Identity document verification is required to complete check-in"),
        {
          statusCode: 422,
          code: "IDENTITY_VERIFICATION_REQUIRED",
        },
      );
    }
    if (!input.paymentMethodVerified) {
      recordCheckinOutcome("complete", "invalid");
      throw Object.assign(
        new Error("A verified payment method (guarantee) is required to complete check-in"),
        { statusCode: 422, code: "PAYMENT_GUARANTEE_REQUIRED" },
      );
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

    const row = rows[0] as NonNullable<(typeof rows)[0]>;
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
): Promise<ReservationBriefRow | null> => {
  const { rows } = await query<ReservationBriefRow>(RESERVATION_BY_CONFIRMATION_SQL, [
    confirmationCode,
  ]);
  return rows[0] ?? null;
};

/**
 * Get a mobile check-in record by ID.
 */
export const getCheckinById = async (mobileCheckinId: string): Promise<MobileCheckinRow | null> => {
  const { rows } = await query<MobileCheckinRow>(GET_CHECKIN_SQL, [mobileCheckinId]);
  return rows[0] ?? null;
};
