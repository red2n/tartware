import {
  type ReservationCancelledEvent,
  ReservationCancelledEventSchema,
  type ReservationCreatedEvent,
  ReservationCreatedEventSchema,
  type ReservationUpdatedEvent,
  ReservationUpdatedEventSchema,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import {
  type AvailabilityGuardMetadata,
  lockReservationHold,
  releaseReservationHold,
} from "../clients/availability-guard-client.js";
import { serviceConfig } from "../config.js";
import { query, withTransaction } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";
import { enqueueOutboxRecordWithClient } from "../outbox/repository.js";
import { recordLifecyclePersisted } from "../repositories/lifecycle-repository.js";
import { insertRateFallbackRecord } from "../repositories/rate-fallback-repository.js";
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
  ReservationAssignRoomCommand,
  ReservationCancelCommand,
  ReservationCheckInCommand,
  ReservationCheckOutCommand,
  ReservationCreateCommand,
  ReservationDepositAddCommand,
  ReservationDepositReleaseCommand,
  ReservationExtendStayCommand,
  ReservationModifyCommand,
  ReservationRateOverrideCommand,
  ReservationUnassignRoomCommand,
} from "../schemas/reservation-command.js";
import type { RatePlanResolution } from "../services/rate-plan-service.js";
import { resolveRatePlan } from "../services/rate-plan-service.js";

class ReservationCommandError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface CreateReservationResult {
  eventId: string;
  correlationId?: string;
  status: "accepted";
}

const DEFAULT_CURRENCY = "USD";
const APP_ACTOR = "COMMAND_CENTER";

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
  const stayStart = new Date(command.check_in_date);
  const stayEnd = new Date(command.check_out_date);

  // Validate check_out_date is after check_in_date
  if (stayEnd <= stayStart) {
    throw new Error("INVALID_DATES: check_out_date must be after check_in_date");
  }

  const rateResolution: RatePlanResolution = await resolveRatePlan({
    tenantId,
    propertyId: command.property_id,
    roomTypeId: command.room_type_id,
    stayStart,
    stayEnd,
    requestedRateCode: command.rate_code,
  });

  // MED-007: Require explicit opt-in for rate fallback to prevent silent repricing
  if (rateResolution.fallbackApplied && !command.allow_rate_fallback) {
    throw new ReservationCommandError(
      "RATE_FALLBACK_NOT_ALLOWED",
      `Requested rate code "${rateResolution.requestedRateCode}" is unavailable. ` +
        `Fallback to "${rateResolution.appliedRateCode}" requires allow_rate_fallback=true. ` +
        `Reason: ${rateResolution.reason}`,
    );
  }

  const rateFallbackMetadata = rateResolution.fallbackApplied
    ? {
        requestedCode: rateResolution.requestedRateCode,
        appliedCode: rateResolution.appliedRateCode,
        reason: rateResolution.reason,
        decidedBy: serviceConfig.serviceId,
        decidedAt: rateResolution.decidedAt.toISOString(),
      }
    : undefined;

  const normalizedCurrency = (command.currency ?? DEFAULT_CURRENCY).toUpperCase();

  const payload: ReservationCreatedEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.created",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
      ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
    },
    payload: {
      ...command,
      rate_code: rateResolution.appliedRateCode,
      check_in_date: stayStart,
      check_out_date: stayEnd,
      booking_date: command.booking_date ?? new Date(),
      total_amount: command.total_amount,
      currency: normalizedCurrency,
      status: command.status ?? "PENDING",
      source: command.source ?? "DIRECT",
    },
  };

  const validatedEvent = ReservationCreatedEventSchema.parse(payload);
  const aggregateId = validatedEvent.payload.id ?? eventId;
  const partitionKey = validatedEvent.payload.guest_id ?? tenantId;

  const availabilityGuard: AvailabilityGuardMetadata | undefined = await lockReservationHold({
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
    if (rateResolution.fallbackApplied) {
      await insertRateFallbackRecord(client, {
        tenantId,
        reservationId: aggregateId,
        propertyId: command.property_id,
        requestedRateCode: rateResolution.requestedRateCode,
        appliedRateCode: rateResolution.appliedRateCode,
        reason: rateResolution.reason,
        actor: serviceConfig.serviceId,
        correlationId: options.correlationId,
        metadata: {
          decidedAt: rateResolution.decidedAt.toISOString(),
        },
      });
    }

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
        ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
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
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey,
      metadata: {
        source: serviceConfig.serviceId,
        availabilityGuard: guardMetadata,
        ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
      },
    });
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

/**
 * Accept a reservation modify command and enqueue update events.
 */
export const modifyReservation = async (
  tenantId: string,
  command: ReservationModifyCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const snapshot: ReservationStaySnapshot | null = await fetchReservationStaySnapshot(
    tenantId,
    command.reservation_id,
  );
  if (!snapshot) {
    throw new Error(`Reservation ${command.reservation_id} not found for tenant ${tenantId}`);
  }

  const targetPropertyId = command.property_id ?? snapshot.propertyId;
  const targetRoomTypeId = command.room_type_id ?? snapshot.roomTypeId;
  const stayStart = new Date(command.check_in_date ?? snapshot.checkInDate);
  const stayEnd = new Date(command.check_out_date ?? snapshot.checkOutDate);

  // Validate dates (either from command or after merge with snapshot)
  if (stayEnd <= stayStart) {
    throw new Error("INVALID_DATES: check_out_date must be after check_in_date");
  }

  const shouldResolveRate = command.rate_code !== undefined;
  const rateResolution: RatePlanResolution | null = shouldResolveRate
    ? await resolveRatePlan({
        tenantId,
        propertyId: targetPropertyId,
        roomTypeId: targetRoomTypeId,
        stayStart,
        stayEnd,
        requestedRateCode: command.rate_code,
      })
    : null;

  // MED-007: Require explicit opt-in for rate fallback to prevent silent repricing
  if (rateResolution?.fallbackApplied && !command.allow_rate_fallback) {
    throw new ReservationCommandError(
      "RATE_FALLBACK_NOT_ALLOWED",
      `Requested rate code "${rateResolution.requestedRateCode}" is unavailable. ` +
        `Fallback to "${rateResolution.appliedRateCode}" requires allow_rate_fallback=true. ` +
        `Reason: ${rateResolution.reason}`,
    );
  }

  const rateFallbackMetadata = rateResolution?.fallbackApplied
    ? {
        requestedCode: rateResolution.requestedRateCode,
        appliedCode: rateResolution.appliedRateCode,
        reason: rateResolution.reason,
        decidedBy: serviceConfig.serviceId,
        decidedAt: rateResolution.decidedAt.toISOString(),
      }
    : undefined;

  const eventId = uuid();
  const updatePayload = buildReservationUpdatePayload(
    tenantId,
    command,
    rateResolution?.appliedRateCode,
  );
  const payload: ReservationUpdatedEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.updated",
      timestamp: new Date().toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
      ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
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
    if (rateResolution?.fallbackApplied) {
      await insertRateFallbackRecord(client, {
        tenantId,
        reservationId: command.reservation_id,
        propertyId: targetPropertyId,
        requestedRateCode: rateResolution.requestedRateCode,
        appliedRateCode: rateResolution.appliedRateCode,
        reason: rateResolution.reason,
        actor: serviceConfig.serviceId,
        correlationId: options.correlationId,
        metadata: {
          decidedAt: rateResolution.decidedAt.toISOString(),
        },
      });
    }

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
        ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
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
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.reservation_id,
      metadata: {
        source: serviceConfig.serviceId,
        availabilityGuard: guardMetadata,
        ...(rateFallbackMetadata ? { rateFallback: rateFallbackMetadata } : {}),
      },
    });
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

type ReservationUpdatePayload = ReservationUpdatedEvent["payload"];

const enqueueReservationUpdate = async (
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

const fetchRoomNumber = async (tenantId: string, roomId: string): Promise<string | null> => {
  const { rows } = await query<{ room_number: string | null }>(
    `
      SELECT room_number
      FROM public.rooms
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1
    `,
    [tenantId, roomId],
  );
  return rows[0]?.room_number ?? null;
};

/**
 * Check in a reservation and enqueue update event.
 */
export const checkInReservation = async (
  tenantId: string,
  command: ReservationCheckInCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const roomNumber = command.room_id ? await fetchRoomNumber(tenantId, command.room_id) : null;
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    status: "CHECKED_IN",
    actual_check_in: command.checked_in_at ?? new Date(),
    ...(roomNumber ? { room_number: roomNumber } : {}),
    internal_notes: command.notes,
    metadata: command.metadata,
  };
  return enqueueReservationUpdate(tenantId, "reservation.check_in", updatePayload, options);
};

/**
 * Check out a reservation and enqueue update event.
 */
export const checkOutReservation = async (
  tenantId: string,
  command: ReservationCheckOutCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    status: "CHECKED_OUT",
    actual_check_out: command.checked_out_at ?? new Date(),
    internal_notes: command.notes,
    metadata: command.metadata,
  };
  return enqueueReservationUpdate(tenantId, "reservation.check_out", updatePayload, options);
};

/**
 * Assign a room to a reservation with availability guard.
 */
export const assignRoom = async (
  tenantId: string,
  command: ReservationAssignRoomCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  const roomNumber = await fetchRoomNumber(tenantId, command.room_id);
  if (!roomNumber) {
    throw new Error("ROOM_NOT_FOUND");
  }

  // Fetch reservation to get stay dates for availability check
  const snapshot = await fetchReservationStaySnapshot(tenantId, command.reservation_id);
  if (!snapshot) {
    throw new Error("RESERVATION_NOT_FOUND");
  }

  // Verify room is available for the reservation's date range
  const guardMetadata = await lockReservationHold({
    tenantId,
    reservationId: command.reservation_id,
    roomTypeId: snapshot.roomTypeId,
    roomId: command.room_id, // Check specific room availability
    stayStart: new Date(snapshot.checkInDate),
    stayEnd: new Date(snapshot.checkOutDate),
    reason: "RESERVATION_ASSIGN_ROOM",
    correlationId: options.correlationId ?? eventId,
  });

  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    room_number: roomNumber,
    internal_notes: command.notes,
    metadata: {
      ...command.metadata,
      availabilityGuard: guardMetadata,
    },
  };
  return enqueueReservationUpdate(tenantId, "reservation.assign_room", updatePayload, options);
};

/**
 * Remove room assignment from a reservation.
 */
export const unassignRoom = async (
  tenantId: string,
  command: ReservationUnassignRoomCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    room_number: null,
    internal_notes: command.reason,
    metadata: command.metadata,
  };
  return enqueueReservationUpdate(tenantId, "reservation.unassign_room", updatePayload, options);
};

/**
 * Extend reservation stay dates with availability guard.
 */
export const extendStay = async (
  tenantId: string,
  command: ReservationExtendStayCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  // Fetch current reservation to check if extension requires availability lock
  const snapshot = await fetchReservationStaySnapshot(tenantId, command.reservation_id);
  if (!snapshot) {
    throw new Error("RESERVATION_NOT_FOUND");
  }

  const newCheckOut = new Date(command.new_check_out_date);
  const currentCheckOut = new Date(snapshot.checkOutDate);
  const checkIn = new Date(snapshot.checkInDate);

  // Validate new checkout is after check-in
  if (newCheckOut <= checkIn) {
    throw new Error("INVALID_DATES: new_check_out_date must be after check_in_date");
  }

  // If extending (new checkout is later), verify availability for extended period
  let guardMetadata: AvailabilityGuardMetadata = {
    status: "SKIPPED",
    message: "NO_EXTENSION_REQUIRED",
  };

  if (newCheckOut > currentCheckOut) {
    guardMetadata = await lockReservationHold({
      tenantId,
      reservationId: command.reservation_id,
      roomTypeId: snapshot.roomTypeId,
      roomId: null, // Room assignment handled separately
      stayStart: currentCheckOut, // Lock from current checkout to new checkout
      stayEnd: newCheckOut,
      reason: "RESERVATION_EXTEND_STAY",
      correlationId: options.correlationId ?? eventId,
    });
  }

  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    check_out_date: command.new_check_out_date,
    internal_notes: command.reason,
    metadata: {
      ...command.metadata,
      availabilityGuard: guardMetadata,
    },
  };
  return enqueueReservationUpdate(tenantId, "reservation.extend_stay", updatePayload, options);
};

/**
 * Override the reservation rate code and amount.
 */
export const overrideRate = async (
  tenantId: string,
  command: ReservationRateOverrideCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    rate_code: command.rate_code?.toUpperCase(),
    total_amount: command.total_amount,
    currency: command.currency?.toUpperCase(),
    internal_notes: command.reason,
    metadata: command.metadata,
  };
  return enqueueReservationUpdate(tenantId, "reservation.rate_override", updatePayload, options);
};

/**
 * Add a reservation deposit entry.
 */
export const addDeposit = async (
  tenantId: string,
  command: ReservationDepositAddCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    internal_notes: command.notes,
    metadata: {
      deposit_event: {
        type: "add",
        amount: command.amount,
        currency: command.currency ?? DEFAULT_CURRENCY,
        method: command.method,
        recorded_at: new Date().toISOString(),
        actor: APP_ACTOR,
      },
      ...(command.metadata ?? {}),
    },
  };
  return enqueueReservationUpdate(tenantId, "reservation.add_deposit", updatePayload, options);
};

/**
 * Release a reservation deposit entry.
 */
export const releaseDeposit = async (
  tenantId: string,
  command: ReservationDepositReleaseCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    internal_notes: command.reason,
    metadata: {
      deposit_event: {
        type: "release",
        amount: command.amount,
        deposit_id: command.deposit_id,
        recorded_at: new Date().toISOString(),
        actor: APP_ACTOR,
      },
      ...(command.metadata ?? {}),
    },
  };
  return enqueueReservationUpdate(tenantId, "reservation.release_deposit", updatePayload, options);
};

/**
 * Cancel a reservation and release availability holds.
 */
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
      retryCount: 0,
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

  const guardRecord: StoredGuardMetadata | null = await getReservationGuardMetadata(
    tenantId,
    command.reservation_id,
  );
  const releaseLockId = guardRecord?.lockId ?? command.reservation_id;

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
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
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

  // Release availability hold AFTER transaction succeeds
  // If this fails, reservation is cancelled but hold remains (safer than reverse)
  try {
    await releaseReservationHold({
      tenantId,
      lockId: releaseLockId,
      reservationId: command.reservation_id,
      reason: command.reason ?? "RESERVATION_CANCEL",
      correlationId: options.correlationId ?? eventId,
    });
  } catch (releaseError) {
    reservationsLogger.warn(
      {
        reservationId: command.reservation_id,
        lockId: releaseLockId,
        error: releaseError,
      },
      "Failed to release availability hold after cancellation - hold may require manual cleanup",
    );
  }

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

const buildReservationUpdatePayload = (
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

const hasStayCriticalChanges = (
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
