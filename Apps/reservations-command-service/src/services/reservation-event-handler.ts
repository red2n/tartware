import type {
  ReservationCancelledEvent,
  ReservationCreatedEvent,
  ReservationEvent,
  ReservationUpdatedEvent,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import { query } from "../lib/db.js";

import { refreshReservationProjection } from "./reservation-projection-service.js";

export const processReservationEvent = async (
  event: ReservationEvent,
): Promise<void> => {
  const eventType = event.metadata.type;
  switch (eventType) {
    case "reservation.created":
      await handleReservationCreated(event as ReservationCreatedEvent);
      break;
    case "reservation.updated":
      await handleReservationUpdated(event as ReservationUpdatedEvent);
      break;
    case "reservation.cancelled":
      await handleReservationCancelled(event as ReservationCancelledEvent);
      break;
    default:
      console.warn("Unhandled reservation event type", eventType);
  }
};

const handleReservationCreated = async (
  event: ReservationCreatedEvent,
): Promise<void> => {
  const payload = event.payload;
  const reservationId = payload.id ?? uuid();
  const confirmation =
    (payload as { confirmation_number?: string }).confirmation_number ??
    `TW-${reservationId.slice(0, 8).toUpperCase()}`;

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

  await refreshReservationProjection({
    reservationId,
    eventId: event.metadata.id,
    eventType: event.metadata.type,
    eventTimestamp: event.metadata.timestamp,
  });
};

const handleReservationUpdated = async (
  event: ReservationUpdatedEvent,
): Promise<void> => {
  const payload = event.payload;
  const fields: string[] = [];
  const values: unknown[] = [];

  const addField = (column: string, value: unknown) => {
    fields.push(`${column} = $${fields.length + 2}`);
    values.push(value);
  };

  if (payload.property_id) addField("property_id", payload.property_id);
  if (payload.guest_id) addField("guest_id", payload.guest_id);
  if (payload.room_type_id) addField("room_type_id", payload.room_type_id);
  if (payload.check_in_date) addField("check_in_date", payload.check_in_date);
  if (payload.check_out_date)
    addField("check_out_date", payload.check_out_date);
  if (payload.status) addField("status", payload.status);
  if (payload.source) addField("source", payload.source);
  if (payload.total_amount !== undefined)
    addField("total_amount", Number(payload.total_amount ?? 0));
  if (payload.currency) addField("currency", payload.currency);
  if ((payload as { confirmation_number?: string }).confirmation_number) {
    addField(
      "confirmation_number",
      (payload as { confirmation_number?: string }).confirmation_number,
    );
  }

  if (fields.length === 0) {
    return;
  }

  const sql = `
    UPDATE reservations
    SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id = $1
  `;

  await query(sql, [payload.id, ...values]);

  await refreshReservationProjection({
    reservationId: payload.id,
    eventId: event.metadata.id,
    eventType: event.metadata.type,
    eventTimestamp: event.metadata.timestamp,
  });
};

const handleReservationCancelled = async (
  event: ReservationCancelledEvent,
): Promise<void> => {
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

  await refreshReservationProjection({
    reservationId: payload.id,
    eventId: event.metadata.id,
    eventType: event.metadata.type,
    eventTimestamp: event.metadata.timestamp,
  });
};
