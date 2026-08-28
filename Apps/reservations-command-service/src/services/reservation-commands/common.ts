import { CommandError, SYSTEM_ACTOR_ID } from "@tartware/command-consumer-utils/command-utils";
import type {
  CreateReservationResult,
  ReasonCodeRow,
  ReservationUpdatedEvent,
} from "@tartware/schemas";
import { ReservationUpdatedEventSchema } from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import { recordLifecyclePersisted } from "../../repositories/lifecycle-repository.js";
import type { ReservationModifyCommand } from "../../schemas/reservation-command.js";
import { hashIdentifier, recordAuditLog, redactPayload } from "../../utils/audit.js";

/**
 * Reservation command failure. `retryable` defaults to false — see
 * {@link CommandError} for why a retried business rejection is worse than an
 * immediate DLQ routing.
 */
export class ReservationCommandError extends CommandError {}

export type { CreateReservationResult };

export const DEFAULT_CURRENCY = "USD";

/**
 * Human-readable label recorded inside event `metadata` JSON (not an actor id —
 * never write this to a `created_by` / `updated_by` column).
 */
export const APP_ACTOR = "COMMAND_CENTER";

export { SYSTEM_ACTOR_ID };

export type ReservationUpdatePayload = ReservationUpdatedEvent["payload"];

/**
 * Fill in the reservation identity fields that downstream consumers need but
 * that individual commands rarely bother to set.
 *
 * Lifecycle commands (no-show, cancel, check-in/out) build a minimal payload —
 * usually just id/tenant_id/status/metadata. Consumers such as the notification
 * service key off property_id, guest_id, guest_name and guest_email, and an
 * absent property_id used to reach them as an empty string, which then failed
 * the uuid cast on insert and parked the event in the DLQ. Hydrating here keeps
 * every publish site consistent instead of patching each command.
 */
const hydrateReservationIdentity = async (
  tenantId: string,
  payload: ReservationUpdatePayload,
): Promise<ReservationUpdatePayload> => {
  const needs = (value: unknown): boolean =>
    value === undefined || value === null || (typeof value === "string" && value.trim() === "");

  if (
    !needs(payload.property_id) &&
    !needs(payload.guest_id) &&
    !needs(payload.guest_name) &&
    !needs(payload.guest_email)
  ) {
    return payload;
  }

  const { rows } = await query<{
    property_id: string | null;
    guest_id: string | null;
    guest_name: string | null;
    guest_email: string | null;
  }>(
    `SELECT property_id, guest_id, guest_name, guest_email
       FROM reservations
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1`,
    [payload.id, tenantId],
  );
  const row = rows[0];
  if (!row) {
    return payload;
  }

  return {
    ...payload,
    property_id: needs(payload.property_id) ? (row.property_id ?? undefined) : payload.property_id,
    guest_id: needs(payload.guest_id) ? (row.guest_id ?? undefined) : payload.guest_id,
    guest_name: needs(payload.guest_name) ? (row.guest_name ?? undefined) : payload.guest_name,
    guest_email: needs(payload.guest_email) ? (row.guest_email ?? undefined) : payload.guest_email,
  } as ReservationUpdatePayload;
};

export const enqueueReservationUpdate = async (
  tenantId: string,
  commandName: string,
  rawPayload: ReservationUpdatePayload,
  options: { correlationId?: string; actorId?: string } = {},
): Promise<CreateReservationResult> => {
  const payload = await hydrateReservationIdentity(tenantId, rawPayload);
  const eventId = uuid();
  const updateEvent = ReservationUpdatedEventSchema.parse({
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.updated",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
    },
    payload,
  });

  const aggregateId = updateEvent.payload.id;
  const partitionKey = aggregateId;

  await withTransaction(async (client) => {
    await recordLifecyclePersisted(client, {
      eventId,
      tenantId,
      reservationId: aggregateId,
      commandName,
      correlationId: options.correlationId,
      partitionKey,
      details: {
        tenantId,
        reservationId: aggregateId,
        command: commandName,
      },
      metadata: {
        eventType: updateEvent.metadata.type,
      },
    });

    await recordAuditLog({
      tenantId,
      propertyId: payload.property_id || null,
      actorId: options.actorId ?? SYSTEM_ACTOR_ID,
      action: commandName,
      eventType: "UPDATE",
      entityType: "reservation",
      entityId: aggregateId,
      metadata: {
        event_id: hashIdentifier(eventId),
        reservation_id: hashIdentifier(aggregateId),
        guest_id: payload.guest_id ? hashIdentifier(payload.guest_id) : null,
        status: payload.status || null,
        redacted_payload: redactPayload(payload),
        command: commandName,
      },
    });

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId,
      aggregateType: "reservation",
      eventType: updateEvent.metadata.type,
      payload: updateEvent,
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey,
      metadata: {
        source: serviceConfig.serviceId,
      },
    });
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

type RoomInfo = { roomNumber: string; roomTypeId: string };

/**
 * Fetch a room's display number and type. Returns null when the room does not
 * exist or has been soft-deleted.
 */
export const fetchRoomInfo = async (tenantId: string, roomId: string): Promise<RoomInfo | null> => {
  const { rows } = await query<{ room_number: string | null; room_type_id: string }>(
    `
      SELECT room_number, room_type_id
      FROM public.rooms
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `,
    [tenantId, roomId],
  );
  const row = rows[0];
  if (!row || row.room_number == null) return null;
  return { roomNumber: row.room_number, roomTypeId: row.room_type_id };
};

/**
 * Find the best available room matching a room type for the given stay dates.
 * Selects the first clean, available room with no overlapping locks or reservations.
 * Used for auto-assignment at check-in and walk-in express.
 */
export const findBestAvailableRoom = async (
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<{ room_id: string; room_number: string } | null> => {
  const { rows } = await query<{ room_id: string; room_number: string }>(
    `SELECT r.id AS room_id, r.room_number
     FROM rooms r
     WHERE r.tenant_id = $1::uuid
       AND r.property_id = $2::uuid
       AND r.room_type_id = $3::uuid
       AND r.status = 'AVAILABLE'
       AND r.housekeeping_status IN ('CLEAN', 'INSPECTED')
       AND COALESCE(r.is_blocked, false) = false
       AND COALESCE(r.is_out_of_order, false) = false
       AND COALESCE(r.is_deleted, false) = false
       AND NOT EXISTS (
         SELECT 1 FROM inventory_locks_shadow ils
         WHERE ils.room_id = r.id AND ils.tenant_id = r.tenant_id
           AND ils.status = 'ACTIVE'
           AND ils.stay_start < $5::date AND ils.stay_end > $4::date
       )
       AND NOT EXISTS (
         SELECT 1 FROM reservations res
         WHERE res.room_number = r.room_number AND res.tenant_id = r.tenant_id
           AND res.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
           AND res.check_in_date < $5::date AND res.check_out_date > $4::date
       )
     ORDER BY r.room_number
     LIMIT 1`,
    [tenantId, propertyId, roomTypeId, checkIn.toISOString(), checkOut.toISOString()],
  );
  return rows[0] ?? null;
};

export const buildReservationUpdatePayload = (
  tenantId: string,
  command: ReservationModifyCommand,
  rateCode?: string,
): ReservationUpdatedEvent["payload"] => {
  const payload: ReservationUpdatedEvent["payload"] = {
    id: command.reservation_id,
    tenant_id: tenantId,
  };

  if (command.property_id) {
    payload.property_id = command.property_id;
  }
  if (command.guest_id) {
    payload.guest_id = command.guest_id;
  }
  if (command.room_type_id) {
    payload.room_type_id = command.room_type_id;
  }
  if (command.check_in_date) {
    payload.check_in_date = command.check_in_date;
  }
  if (command.check_out_date) {
    payload.check_out_date = command.check_out_date;
  }
  if (command.booking_date) {
    payload.booking_date = command.booking_date;
  }
  if (command.status) {
    payload.status = command.status;
  }
  if (command.total_amount !== undefined) {
    payload.total_amount = command.total_amount;
  }
  if (command.currency) {
    payload.currency = command.currency.toUpperCase();
  }
  if (command.notes) {
    payload.internal_notes = command.notes;
  }
  if (command.market_segment_id) {
    payload.market_segment_id = command.market_segment_id;
  }
  if (rateCode) {
    payload.rate_code = rateCode;
  } else if (command.rate_code) {
    payload.rate_code = command.rate_code.toUpperCase();
  }
  return payload;
};

export const hasStayCriticalChanges = (
  command: ReservationModifyCommand,
  snapshot: {
    roomTypeId: string;
    checkInDate: Date;
    checkOutDate: Date;
  },
): boolean => {
  const roomTypeChanged =
    command.room_type_id !== undefined && command.room_type_id !== snapshot.roomTypeId;
  const checkInChanged =
    command.check_in_date !== undefined &&
    new Date(command.check_in_date).getTime() !== snapshot.checkInDate.getTime();
  const checkOutChanged =
    command.check_out_date !== undefined &&
    new Date(command.check_out_date).getTime() !== snapshot.checkOutDate.getTime();

  return roomTypeChanged || checkInChanged || checkOutChanged;
};

/**
 * Resolve the reason code, or refuse.
 *
 * `reason_codes` has existed as a table with no route and no reader since it
 * was created. A reversal is the first thing in the product with a real need
 * for it: "why did someone undo this" is the first question an audit asks, and
 * free text does not answer it consistently.
 *
 * Resolution is a three-level hierarchy, most specific first: a property's own
 * code, then the tenant's, then the system defaults seeded under the all-zero
 * tenant. That last level is the one that matters — every reference code the
 * product ships (ROOM_MOVE, CANCELLATION, RATE_OVERRIDE, DEPOSIT_OVERRIDE) is
 * seeded there, and a resolver that looked only at the caller's tenant could
 * not see any of them. A tenant inherits the defaults until it defines its own.
 */
const SYSTEM_REASON_TENANT = "00000000-0000-0000-0000-000000000000";

export const resolveReasonCode = async (
  tenantId: string,
  propertyId: string | null,
  reasonCode: string,
  category: string,
): Promise<ReasonCodeRow> => {
  const result = await query<ReasonCodeRow>(
    `SELECT reason_id, reason_code, reason_name, reason_category,
            requires_approval, has_financial_impact
       FROM public.reason_codes
      WHERE tenant_id IN ($1::uuid, $4::uuid)
        AND UPPER(reason_code) = UPPER($2)
        AND COALESCE(is_active, true) = true
        AND COALESCE(is_deleted, false) = false
        AND (property_id IS NULL OR property_id = $3::uuid)
      ORDER BY (tenant_id = $1::uuid) DESC, property_id NULLS LAST
      LIMIT 1`,
    [tenantId, reasonCode, propertyId, SYSTEM_REASON_TENANT],
  );

  const row = result.rows[0];
  if (!row) {
    throw new ReservationCommandError(
      "REASON_CODE_NOT_FOUND",
      `Reason code "${reasonCode}" is not configured for this tenant. ` +
        `This command requires a reason code from the reason_codes reference table.`,
    );
  }

  // A code exists but belongs to a different kind of event — voiding a check-in
  // with a "room move" reason produces an audit trail that reads as a lie.
  if (row.reason_category && row.reason_category.toUpperCase() !== category) {
    throw new ReservationCommandError(
      "REASON_CODE_WRONG_CATEGORY",
      `Reason code "${reasonCode}" is category ${row.reason_category}, not ${category}`,
    );
  }

  return row;
};
