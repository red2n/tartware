import type {
  ReservationCancelledEvent,
  ReservationCreatedEvent,
  ReservationEvent,
  ReservationUpdatedEvent,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import { query } from "../lib/db.js";

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
        reservationId: await handleReservationCreated(
          event as ReservationCreatedEvent,
        ),
      };
    case "reservation.updated":
      return {
        reservationId: await handleReservationUpdated(
          event as ReservationUpdatedEvent,
        ),
      };
    case "reservation.cancelled":
      return {
        reservationId: await handleReservationCancelled(
          event as ReservationCancelledEvent,
        ),
      };
    default:
      console.warn("Unhandled reservation event type", eventType);
      return {};
  }
};

const handleReservationCreated = async (
  event: ReservationCreatedEvent,
): Promise<string> => {
  const payload = event.payload;
  const tenantId = event.metadata.tenantId;
  const reservationId = payload.id ?? uuid();
  const confirmation =
    (payload as { confirmation_number?: string }).confirmation_number ??
    `TW-${reservationId.slice(0, 8).toUpperCase()}`;

  // MED-008: Validate property belongs to tenant before creating reservation
  await validatePropertyBelongsToTenant(tenantId, payload.property_id);

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
        total_amount,
        currency,
        confirmation_number,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, NOW(), NOW()
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
          total_amount = EXCLUDED.total_amount,
          currency = EXCLUDED.currency,
          confirmation_number = EXCLUDED.confirmation_number,
          updated_at = NOW();
    `,
    [
      reservationId,
      event.metadata.tenantId,
      payload.property_id,
      payload.guest_id,
      payload.room_type_id,
      payload.check_in_date,
      payload.check_out_date,
      payload.booking_date ?? new Date().toISOString(),
      payload.status ?? "PENDING",
      payload.source ?? "DIRECT",
      Number(payload.total_amount ?? 0),
      payload.currency ?? "USD",
      confirmation,
    ],
  );
  return reservationId;
};

const handleReservationUpdated = async (
  event: ReservationUpdatedEvent,
): Promise<string> => {
  const payload = event.payload;
  const tenantId = event.metadata.tenantId;
  const fields: string[] = [];
  const values: unknown[] = [];

  const addField = (column: string, value: unknown) => {
    fields.push(`${column} = $${fields.length + 2}`);
    values.push(value);
  };

  // MED-008: Validate property belongs to tenant if property_id is being changed
  if (payload.property_id) {
    await validatePropertyBelongsToTenant(tenantId, payload.property_id);
    addField("property_id", payload.property_id);
  }
  if (payload.guest_id) addField("guest_id", payload.guest_id);
  if (payload.room_type_id) addField("room_type_id", payload.room_type_id);
  if (payload.check_in_date) addField("check_in_date", payload.check_in_date);
  if (payload.check_out_date)
    addField("check_out_date", payload.check_out_date);
  if (payload.actual_check_in)
    addField("actual_check_in", payload.actual_check_in);
  if (payload.actual_check_out)
    addField("actual_check_out", payload.actual_check_out);
  if (payload.room_number !== undefined)
    addField("room_number", payload.room_number);
  if (payload.status) addField("status", payload.status);
  if (payload.source) addField("source", payload.source);
  if (payload.total_amount !== undefined)
    addField("total_amount", Number(payload.total_amount ?? 0));
  if (payload.currency) addField("currency", payload.currency);
  if (payload.internal_notes !== undefined)
    addField("internal_notes", payload.internal_notes);
  if (payload.metadata !== undefined) {
    const index = fields.length + 2;
    fields.push(
      `metadata = COALESCE(metadata, '{}'::jsonb) || $${index}::jsonb`,
    );
    values.push(JSON.stringify(payload.metadata ?? {}));
  }
  if ((payload as { confirmation_number?: string }).confirmation_number) {
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
    SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id = $1
  `;

  await query(sql, [payload.id, ...values]);
  return payload.id;
};

const handleReservationCancelled = async (
  event: ReservationCancelledEvent,
): Promise<string> => {
  const payload = event.payload;
  await query(
    `
      UPDATE reservations
      SET
        status = 'CANCELLED',
        cancellation_date = $2,
        cancellation_reason = $3,
        updated_at = NOW()
      WHERE id = $1
    `,
    [payload.id, payload.cancelled_at, payload.reason ?? null],
  );
  return payload.id;
};
