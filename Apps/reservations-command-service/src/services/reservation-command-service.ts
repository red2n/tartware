import type {
  ReservationCancelledEvent,
  ReservationCreatedEvent,
  ReservationUpdatedEvent,
} from "@tartware/schemas";
import {
  ReservationCancelledEventSchema,
  ReservationCreatedEventSchema,
  ReservationUpdatedEventSchema,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import {
  type AvailabilityGuardMetadata,
  lockReservationHold,
  releaseReservationHold,
} from "../clients/availability-guard-client.js";
import { serviceConfig } from "../config.js";
import { withTransaction } from "../lib/db.js";
import { enqueueOutboxRecordWithClient } from "../outbox/repository.js";
import { recordLifecyclePersisted } from "../repositories/lifecycle-repository.js";
import {
  getReservationGuardMetadata,
  type ReservationGuardMetadata as StoredGuardMetadata,
  upsertReservationGuardMetadata,
} from "../repositories/reservation-guard-metadata-repository.js";
import {
  fetchReservationStaySnapshot,
  type ReservationStaySnapshot,
} from "../repositories/reservation-repository.js";
import type {
  ReservationCancelCommand,
  ReservationCreateCommand,
  ReservationModifyCommand,
} from "../schemas/reservation-command.js";

interface CreateReservationResult {
  eventId: string;
  correlationId?: string;
  status: "accepted";
}

const DEFAULT_CURRENCY = "USD";

/**
 * Accepts a reservation create command and enqueues its event payload
 * in the transactional outbox for asynchronous processing.
 */
export const createReservation = async (
  tenantId: string,
  command: ReservationCreateCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const payload: ReservationCreatedEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.created",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
    },
    payload: {
      ...command,
      check_in_date: command.check_in_date,
      check_out_date: command.check_out_date,
      booking_date: command.booking_date ?? new Date(),
      total_amount: command.total_amount,
      currency: command.currency ?? DEFAULT_CURRENCY,
      status: command.status ?? "PENDING",
      source: command.source ?? "DIRECT",
    },
  };

  const validatedEvent = ReservationCreatedEventSchema.parse(payload);
  const aggregateId = validatedEvent.payload.id ?? eventId;
  const partitionKey = validatedEvent.payload.guest_id ?? tenantId;

  const availabilityGuard: AvailabilityGuardMetadata | undefined =
    await lockReservationHold({
      tenantId,
      reservationId: aggregateId,
      roomTypeId: command.room_type_id,
      roomId: null,
      stayStart: new Date(command.check_in_date),
      stayEnd: new Date(command.check_out_date),
      reason: "RESERVATION_CREATE",
      correlationId: options.correlationId ?? eventId,
    });

  const guardMetadata = availabilityGuard ?? { status: "SKIPPED" };

  await withTransaction(async (client) => {
    await recordLifecyclePersisted(client, {
      eventId,
      tenantId,
      reservationId: aggregateId,
      commandName: "reservation.create",
      correlationId: options.correlationId,
      partitionKey,
      details: {
        tenantId,
        reservationId: aggregateId,
        command: "reservation.create",
      },
      metadata: {
        eventType: validatedEvent.metadata.type,
        availabilityGuard: guardMetadata,
      },
    });

    if (guardMetadata.status === "LOCKED" && guardMetadata.lockId) {
      await upsertReservationGuardMetadata(
        {
          tenantId,
          reservationId: aggregateId,
          lockId: guardMetadata.lockId,
          status: guardMetadata.status,
          metadata: guardMetadata,
        },
        client,
      );
    }

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId,
      aggregateType: "reservation",
      eventType: validatedEvent.metadata.type,
      payload: validatedEvent,
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId
          ? { correlationId: options.correlationId }
          : {}),
      },
      correlationId: options.correlationId,
      partitionKey,
      metadata: {
        source: serviceConfig.serviceId,
        availabilityGuard: guardMetadata,
      },
    });
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

export const modifyReservation = async (
  tenantId: string,
  command: ReservationModifyCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const snapshot: ReservationStaySnapshot | null =
    await fetchReservationStaySnapshot(tenantId, command.reservation_id);
  if (!snapshot) {
    throw new Error(
      `Reservation ${command.reservation_id} not found for tenant ${tenantId}`,
    );
  }

  const eventId = uuid();
  const updatePayload = buildReservationUpdatePayload(tenantId, command);
  const payload: ReservationUpdatedEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.updated",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
    },
    payload: updatePayload,
  };

  const validatedEvent = ReservationUpdatedEventSchema.parse(payload);
  const stayChanged = hasStayCriticalChanges(command, snapshot);
  const guardMetadata: AvailabilityGuardMetadata = stayChanged
    ? await lockReservationHold({
        tenantId,
        reservationId: command.reservation_id,
        roomTypeId: command.room_type_id ?? snapshot.roomTypeId,
        roomId: null,
        stayStart: new Date(command.check_in_date ?? snapshot.checkInDate),
        stayEnd: new Date(command.check_out_date ?? snapshot.checkOutDate),
        reason: "RESERVATION_MODIFY",
        correlationId: options.correlationId ?? eventId,
      })
    : {
        status: "SKIPPED",
        message: "NO_STAY_CRITICAL_CHANGES",
      };

  await withTransaction(async (client) => {
    await recordLifecyclePersisted(client, {
      eventId,
      tenantId,
      reservationId: command.reservation_id,
      commandName: "reservation.modify",
      correlationId: options.correlationId,
      partitionKey: command.reservation_id,
      details: {
        tenantId,
        reservationId: command.reservation_id,
        command: "reservation.modify",
      },
      metadata: {
        eventType: validatedEvent.metadata.type,
        availabilityGuard: guardMetadata,
      },
    });

    if (guardMetadata.status === "LOCKED" && guardMetadata.lockId) {
      await upsertReservationGuardMetadata(
        {
          tenantId,
          reservationId: command.reservation_id,
          lockId: guardMetadata.lockId,
          status: guardMetadata.status,
          metadata: guardMetadata,
        },
        client,
      );
    }

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.reservation_id,
      aggregateType: "reservation",
      eventType: validatedEvent.metadata.type,
      payload: validatedEvent,
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId
          ? { correlationId: options.correlationId }
          : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.reservation_id,
      metadata: {
        source: serviceConfig.serviceId,
        availabilityGuard: guardMetadata,
      },
    });
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

export const cancelReservation = async (
  tenantId: string,
  command: ReservationCancelCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const payload: ReservationCancelledEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.cancelled",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
    },
    payload: {
      id: command.reservation_id,
      tenant_id: tenantId,
      cancelled_at: new Date(),
      cancelled_by: command.cancelled_by,
      reason: command.reason,
    },
  };

  const validatedEvent = ReservationCancelledEventSchema.parse(payload);

  const guardRecord: StoredGuardMetadata | null =
    await getReservationGuardMetadata(tenantId, command.reservation_id);
  const releaseLockId = guardRecord?.lockId ?? command.reservation_id;

  await releaseReservationHold({
    tenantId,
    lockId: releaseLockId,
    reservationId: command.reservation_id,
    reason: command.reason ?? "RESERVATION_CANCEL",
    correlationId: options.correlationId ?? eventId,
  });

  await withTransaction(async (client) => {
    await recordLifecyclePersisted(client, {
      eventId,
      tenantId,
      reservationId: command.reservation_id,
      commandName: "reservation.cancel",
      correlationId: options.correlationId,
      partitionKey: command.reservation_id,
      details: {
        tenantId,
        reservationId: command.reservation_id,
        command: "reservation.cancel",
      },
      metadata: {
        eventType: validatedEvent.metadata.type,
        action: "cancel",
        availabilityGuard: {
          status: "RELEASE_REQUESTED",
          lockId: releaseLockId,
        },
      },
    });

    if (guardRecord) {
      await upsertReservationGuardMetadata(
        {
          tenantId,
          reservationId: command.reservation_id,
          lockId: guardRecord.lockId ?? releaseLockId,
          status: "RELEASE_REQUESTED",
          metadata: {
            previousStatus: guardRecord.status,
            reason: command.reason ?? "RESERVATION_CANCEL",
          },
        },
        client,
      );
    }

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.reservation_id,
      aggregateType: "reservation",
      eventType: validatedEvent.metadata.type,
      payload: validatedEvent,
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId
          ? { correlationId: options.correlationId }
          : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.reservation_id,
      metadata: {
        source: serviceConfig.serviceId,
        action: "cancel",
        availabilityGuard: {
          status: "RELEASE_REQUESTED",
          lockId: releaseLockId,
        },
      },
    });
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

const buildReservationUpdatePayload = (
  tenantId: string,
  command: ReservationModifyCommand,
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
  return payload;
};

const hasStayCriticalChanges = (
  command: ReservationModifyCommand,
  snapshot: {
    roomTypeId: string;
    checkInDate: Date;
    checkOutDate: Date;
  },
): boolean => {
  const roomTypeChanged =
    command.room_type_id !== undefined &&
    command.room_type_id !== snapshot.roomTypeId;
  const checkInChanged =
    command.check_in_date !== undefined &&
    new Date(command.check_in_date).getTime() !==
      snapshot.checkInDate.getTime();
  const checkOutChanged =
    command.check_out_date !== undefined &&
    new Date(command.check_out_date).getTime() !==
      snapshot.checkOutDate.getTime();

  return roomTypeChanged || checkInChanged || checkOutChanged;
};
