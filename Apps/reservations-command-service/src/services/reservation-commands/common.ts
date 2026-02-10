import {
  type ReservationUpdatedEvent,
  ReservationUpdatedEventSchema,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import { recordLifecyclePersisted } from "../../repositories/lifecycle-repository.js";
import type { ReservationModifyCommand } from "../../schemas/reservation-command.js";

export class ReservationCommandError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface CreateReservationResult {
  eventId: string;
  correlationId?: string;
  status: "accepted";
}

export const DEFAULT_CURRENCY = "USD";
export const APP_ACTOR = "COMMAND_CENTER";
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

export type ReservationUpdatePayload = ReservationUpdatedEvent["payload"];

export const enqueueReservationUpdate = async (
  tenantId: string,
  commandName: string,
  payload: ReservationUpdatePayload,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
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

export type RoomInfo = { roomNumber: string; roomTypeId: string };

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
  if (!rows[0]) return null;
  return { roomNumber: rows[0].room_number ?? "", roomTypeId: rows[0].room_type_id };
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
