import type {
  ReservationCancelledEvent,
  ReservationCreatedEvent,
  ReservationEvent,
  ReservationUpdatedEvent,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import { query } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";

/**
 * Result shape returned by reservation event handlers so the caller
 * can persist idempotency metadata (e.g., reservationId).
 */
type ReservationEventHandlerResult = {
  reservationId?: string;
};

class ReservationEventError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * MED-008: Validate that property_id belongs to the given tenant
 * to prevent cross-tenant data pollution from malformed events
 */
const validatePropertyBelongsToTenant = async (
  tenantId: string,
  propertyId: string,
): Promise<void> => {
  const { rowCount } = await query(
    `SELECT 1 FROM properties WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [propertyId, tenantId],
  );
  if (!rowCount || rowCount === 0) {
    throw new ReservationEventError(
      "PROPERTY_NOT_FOUND_FOR_TENANT",
      `Property ${propertyId} does not belong to tenant ${tenantId}`,
    );
  }
};

/**
 * Route reservation events to the appropriate handler.
 */
export const processReservationEvent = async (
  event: ReservationEvent,
): Promise<ReservationEventHandlerResult> => {
  const eventType = event.metadata.type;
  switch (eventType) {
    case "reservation.created":
      return {
        reservationId: await handleReservationCreated(event as ReservationCreatedEvent),
      };
    case "reservation.updated":
      return {
        reservationId: await handleReservationUpdated(event as ReservationUpdatedEvent),
      };
    case "reservation.cancelled":
      return {
        reservationId: await handleReservationCancelled(event as ReservationCancelledEvent),
      };
    default:
      reservationsLogger.warn({ eventType }, "Unhandled reservation event type");
      return {};
  }
};

const handleReservationCreated = async (event: ReservationCreatedEvent): Promise<string> => {
  const payload = event.payload;
  const tenantId = event.metadata.tenantId;
  const reservationId = payload.id ?? uuid();
  const confirmation =
    (payload as { confirmation_number?: string }).confirmation_number ??
    `TW-${reservationId.slice(0, 8).toUpperCase()}`;

  // MED-008: Validate property belongs to tenant before creating reservation
  await validatePropertyBelongsToTenant(tenantId, payload.property_id);

  // Calculate nightly room_rate from total_amount / nights
  const checkIn = new Date(payload.check_in_date);
  const checkOut = new Date(payload.check_out_date);
  const nights = Math.max(
    1,
    Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const totalAmount = Number(payload.total_amount ?? 0);
  const roomRate = Number((totalAmount / nights).toFixed(2));

  // Look up guest details for denormalized guest_name / guest_email columns
  const guestResult = await query(
    `SELECT first_name, last_name, email FROM guests WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [payload.guest_id, tenantId],
  );
  const guest = guestResult.rows?.[0] as
    | { first_name: string; last_name: string; email: string }
    | undefined;
  const guestName = guest
    ? `${guest.first_name ?? ""} ${guest.last_name ?? ""}`.trim()
    : "Unknown Guest";
  const guestEmail = guest?.email ?? "unknown@unknown.com";

  await query(
    `
      INSERT INTO reservations (
        id,
        tenant_id,
        property_id,
        guest_id,
        room_type_id,
        check_in_date,
        check_out_date,
        booking_date,
        status,
        source,
        reservation_type,
        room_rate,
        total_amount,
        currency,
        guest_name,
        guest_email,
        confirmation_number,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
        SET
          property_id = EXCLUDED.property_id,
          guest_id = EXCLUDED.guest_id,
          room_type_id = EXCLUDED.room_type_id,
          check_in_date = EXCLUDED.check_in_date,
          check_out_date = EXCLUDED.check_out_date,
          booking_date = EXCLUDED.booking_date,
          status = EXCLUDED.status,
          source = EXCLUDED.source,
          reservation_type = EXCLUDED.reservation_type,
          room_rate = EXCLUDED.room_rate,
          total_amount = EXCLUDED.total_amount,
          currency = EXCLUDED.currency,
          guest_name = EXCLUDED.guest_name,
          guest_email = EXCLUDED.guest_email,
          confirmation_number = EXCLUDED.confirmation_number,
          updated_at = NOW();
    `,
    [
      reservationId,
      tenantId,
      payload.property_id,
      payload.guest_id,
      payload.room_type_id,
      payload.check_in_date,
      payload.check_out_date,
      payload.booking_date ?? new Date().toISOString(),
      payload.status ?? "PENDING",
      payload.source ?? "DIRECT",
      (payload as { reservation_type?: string }).reservation_type ?? "TRANSIENT",
      roomRate,
      totalAmount,
      payload.currency ?? "USD",
      guestName,
      guestEmail,
      confirmation,
    ],
  );

  // Auto-create a GUEST folio for this reservation (PMS industry standard)
  await createFolioForReservation({
    reservationId,
    tenantId,
    propertyId: payload.property_id,
    guestId: payload.guest_id,
    guestName,
    currency: payload.currency ?? "USD",
  });

  // Increment guest total_bookings on new reservation (PMS industry standard)
  await incrementGuestBookingCount(tenantId, payload.guest_id);

  return reservationId;
};

const handleReservationUpdated = async (event: ReservationUpdatedEvent): Promise<string> => {
  const payload = event.payload;
  const tenantId = event.metadata.tenantId;
  const fields: string[] = [];
  const values: unknown[] = [payload.id, tenantId];

  const addField = (column: string, value: unknown) => {
    fields.push(`${column} = $${fields.length + 3}`);
    values.push(value);
  };

  // MED-008: Validate property belongs to tenant if property_id is being changed
  if (payload.property_id !== undefined) {
    await validatePropertyBelongsToTenant(tenantId, payload.property_id);
    addField("property_id", payload.property_id);
  }
  if (payload.guest_id !== undefined) addField("guest_id", payload.guest_id);
  if (payload.room_type_id !== undefined) addField("room_type_id", payload.room_type_id);
  if (payload.check_in_date !== undefined) addField("check_in_date", payload.check_in_date);
  if (payload.check_out_date !== undefined) addField("check_out_date", payload.check_out_date);
  if (payload.actual_check_in !== undefined) addField("actual_check_in", payload.actual_check_in);
  if (payload.actual_check_out !== undefined) addField("actual_check_out", payload.actual_check_out);
  if (payload.room_number !== undefined) addField("room_number", payload.room_number);
  if (payload.status !== undefined) addField("status", payload.status);
  if (payload.source !== undefined) addField("source", payload.source);
  if (payload.total_amount !== undefined)
    addField("total_amount", Number(payload.total_amount ?? 0));
  if (payload.currency !== undefined) addField("currency", payload.currency);
  if (payload.internal_notes !== undefined) addField("internal_notes", payload.internal_notes);
  if (payload.metadata !== undefined) {
    const index = fields.length + 3;
    fields.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${index}::jsonb`);
    values.push(JSON.stringify(payload.metadata ?? {}));
  }
  if ((payload as { confirmation_number?: string }).confirmation_number !== undefined) {
    addField(
      "confirmation_number",
      (payload as { confirmation_number?: string }).confirmation_number,
    );
  }

  if (fields.length === 0) {
    return payload.id;
  }

  const sql = `
    UPDATE reservations
    SET ${fields.join(", ")}, version = version + 1, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
  `;

  await query(sql, values);
  return payload.id;
};

const handleReservationCancelled = async (event: ReservationCancelledEvent): Promise<string> => {
  const payload = event.payload;
  const tenantId = event.metadata.tenantId;
  await query(
    `
      UPDATE reservations
      SET
        status = 'CANCELLED',
        cancellation_date = $2,
        cancellation_reason = $3,
        cancellation_fee = $4,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $5
    `,
    [
      payload.id,
      payload.cancelled_at,
      payload.reason ?? null,
      payload.cancellation_fee ?? null,
      tenantId,
    ],
  );

  // S21: Auto-offer to waitlisted guests when a reservation is cancelled.
  // Find the cancelled reservation's property + room type + dates, then
  // look for the highest-priority ACTIVE waitlist entry and offer it.
  try {
    const { rows: resRows } = await query<Record<string, unknown>>(
      `SELECT property_id, room_type_id, check_in_date, check_out_date
       FROM reservations WHERE id = $1 AND tenant_id = $2`,
      [payload.id, tenantId],
    );
    const res = resRows[0];
    if (res?.property_id && res?.room_type_id) {
      const { rows: waitlistRows } = await query<Record<string, unknown>>(
        `SELECT waitlist_id, guest_id FROM waitlist_entries
         WHERE tenant_id = $1 AND property_id = $2
           AND requested_room_type_id = $3
           AND waitlist_status = 'ACTIVE'
           AND arrival_date <= $4 AND departure_date >= $5
           AND is_deleted = false
         ORDER BY priority_score DESC, vip_flag DESC, created_at ASC
         LIMIT 1`,
        [tenantId, res.property_id, res.room_type_id, res.check_in_date, res.check_out_date],
      );
      if (waitlistRows[0]) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        await query(
          `UPDATE waitlist_entries
           SET waitlist_status = 'OFFERED',
               offer_expiration_at = $3,
               offer_response = 'PENDING',
               last_notified_at = NOW(),
               last_notified_via = 'EMAIL',
               updated_at = NOW()
           WHERE waitlist_id = $1 AND tenant_id = $2`,
          [waitlistRows[0].waitlist_id, tenantId, expiresAt.toISOString()],
        );
        reservationsLogger.info(
          { waitlistId: waitlistRows[0].waitlist_id, guestId: waitlistRows[0].guest_id, reservationId: payload.id },
          "Auto-offered freed room to waitlisted guest after cancellation",
        );
      }
    }
  } catch (err) {
    // Non-critical: log but don't fail the cancellation
    reservationsLogger.warn({ err, reservationId: payload.id }, "Failed to auto-offer to waitlist after cancellation");
  }

  return payload.id;
};

/**
 * Auto-create a GUEST folio when a reservation is created.
 * PMS industry standard: every reservation must have an associated folio
 * for tracking charges, payments, and settlements throughout the stay.
 *
 * Uses ON CONFLICT to ensure idempotency — duplicate event replays won't
 * create extra folios.
 */
type CreateFolioParams = {
  reservationId: string;
  tenantId: string;
  propertyId: string;
  guestId: string;
  guestName: string;
  currency: string;
};

const createFolioForReservation = async (params: CreateFolioParams): Promise<void> => {
  const folioNumber = `F-${params.reservationId.slice(0, 8).toUpperCase()}`;
  const systemActorId = "33333333-3333-3333-3333-333333333333";

  try {
    await query(
      `
        INSERT INTO folios (
          tenant_id,
          property_id,
          folio_number,
          folio_type,
          folio_status,
          reservation_id,
          guest_id,
          guest_name,
          balance,
          total_charges,
          total_payments,
          total_credits,
          currency_code,
          opened_at,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, 'GUEST', 'OPEN',
          $4, $5, $6,
          0.00, 0.00, 0.00, 0.00,
          $7, NOW(), $8, NOW(), NOW()
        )
        ON CONFLICT (tenant_id, property_id, folio_number) DO NOTHING
      `,
      [
        params.tenantId,
        params.propertyId,
        folioNumber,
        params.reservationId,
        params.guestId,
        params.guestName,
        params.currency,
        systemActorId,
      ],
    );
    reservationsLogger.info(
      { reservationId: params.reservationId, folioNumber },
      "Auto-created GUEST folio for reservation",
    );
  } catch (folioError) {
    // Folio creation is important but should not fail the reservation
    reservationsLogger.error(
      { reservationId: params.reservationId, error: folioError },
      "Failed to auto-create folio for reservation — manual creation required",
    );
  }
};

/**
 * Increment guest total_bookings count when a new reservation is created.
 * Part of guest profile statistics (PMS industry standard).
 * total_nights, total_revenue, and last_stay_date are updated at check-out.
 */
const incrementGuestBookingCount = async (tenantId: string, guestId: string): Promise<void> => {
  try {
    await query(
      `
        UPDATE guests
        SET total_bookings = COALESCE(total_bookings, 0) + 1,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
      `,
      [guestId, tenantId],
    );
  } catch (statsError) {
    reservationsLogger.warn(
      { guestId, tenantId, error: statsError },
      "Failed to increment guest booking count — guest profile stats may be stale",
    );
  }
};

/**
 * Update guest stay statistics at check-out.
 * Increments total_nights, total_revenue, and sets last_stay_date.
 */
export const updateGuestStayStats = async (
  tenantId: string,
  guestId: string,
  nights: number,
  revenue: number,
  checkOutDate: Date,
): Promise<void> => {
  try {
    await query(
      `
        UPDATE guests
        SET total_nights = COALESCE(total_nights, 0) + $3,
            total_revenue = COALESCE(total_revenue, 0) + $4,
            last_stay_date = $5,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
      `,
      [guestId, tenantId, nights, revenue, checkOutDate],
    );
  } catch (statsError) {
    reservationsLogger.warn(
      { guestId, tenantId, error: statsError },
      "Failed to update guest stay stats at check-out",
    );
  }
};
