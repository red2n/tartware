import {
  assertOverrideAuthority,
  SYSTEM_ACTOR_ROLE,
} from "@tartware/command-consumer-utils/command-utils";
import {
  describeReservationStatuses,
  expandStayPlan,
  RESERVATION_INITIAL_STATUSES,
  type ReservationCancelledEvent,
  ReservationCancelledEventSchema,
  type ReservationCreatedEvent,
  ReservationCreatedEventSchema,
  type ReservationStatus,
  type ReservationUpdatedEvent,
  ReservationUpdatedEventSchema,
  StayPlanError,
} from "@tartware/schemas";
import { v4 as uuid, v5 as uuidV5 } from "uuid";

import {
  type AvailabilityGuardMetadata,
  lockReservationHold,
  releaseReservationHold,
} from "../../clients/availability-guard-client.js";
import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import { recordLifecyclePersisted } from "../../repositories/lifecycle-repository.js";
import { insertRateFallbackRecord } from "../../repositories/rate-fallback-repository.js";
import {
  listReservationGuardMetadata,
  type ReservationGuardMetadata as StoredGuardMetadata,
  upsertReservationGuardMetadata,
} from "../../repositories/reservation-guard-metadata-repository.js";
import {
  fetchReservationCancellationInfo,
  fetchReservationStaySnapshot,
  type ReservationStaySnapshot,
} from "../../repositories/reservation-repository.js";
import { resolveBusinessDate } from "../../repositories/restriction-repository.js";
import type {
  ReservationBatchNoShowCommand,
  ReservationCancelCommand,
  ReservationCreateCommand,
  ReservationModifyCommand,
  ReservationNoShowCommand,
  ReservationWalkGuestCommand,
} from "../../schemas/reservation-command.js";
import { type RatePlanResolution, resolveRatePlan } from "../../services/rate-plan-service.js";
import { assertStaySellable } from "../../services/restriction-service.js";
import {
  hashIdentifier,
  recordAuditLog,
  recordFlowApproval,
  redactPayload,
} from "../../utils/audit.js";
import { calculateCancellationFee } from "../cancellation-fee-service.js";

import {
  assertModifiableStatusChange,
  assertReservationTransition,
  buildReservationUpdatePayload,
  type CreateReservationResult,
  DEFAULT_CURRENCY,
  enqueueReservationUpdate,
  hasStayCriticalChanges,
  ReservationCommandError,
  type ReservationUpdatePayload,
  resolveReasonCode,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Namespace for deriving a room's lock id. Any fixed UUID works; this one is
 * arbitrary and must never change, or a retry would stop matching the lock the
 * first attempt took.
 */
const ROOM_LOCK_NAMESPACE = "6f6c3c5e-0f7b-4d3f-9d2a-2b1c8e7a4f10";

/**
 * The idempotency key — and therefore the lock id — for one room of a booking.
 *
 * Derived rather than random so a retried create re-uses the lock its first
 * attempt took instead of stacking a second one, and per-room rather than
 * per-reservation because the guard keys locks by this value: two rooms
 * sharing a key means the second overwrites the first.
 */
const roomLockKey = (reservationId: string, roomSequence: number): string =>
  uuidV5(`${reservationId}:${roomSequence}`, ROOM_LOCK_NAMESPACE);

/**
 * Release every inventory hold a booking is carrying.
 *
 * A booking holds one lock per room, so releasing "the" lock is only ever
 * right for a single-room stay — the rest would stay held until their TTL ran
 * out, quietly shrinking sellable inventory. Failures are logged rather than
 * thrown: the reservation has already been cancelled by the time this runs,
 * and a stranded hold expires on its own, whereas an exception here would
 * leave the caller thinking the cancel failed.
 */
const releaseAllReservationHolds = async (params: {
  tenantId: string;
  reservationId: string;
  records: StoredGuardMetadata[];
  fallbackLockId: string;
  reason: string;
  correlationId?: string;
}): Promise<void> => {
  const lockIds =
    params.records.length > 0
      ? params.records.map((record) => record.lockId ?? params.fallbackLockId)
      : [params.fallbackLockId];

  for (const lockId of lockIds) {
    try {
      await releaseReservationHold({
        tenantId: params.tenantId,
        lockId,
        reservationId: params.reservationId,
        reason: params.reason,
        correlationId: params.correlationId,
      });
    } catch (releaseError) {
      reservationsLogger.warn(
        { reservationId: params.reservationId, lockId, error: releaseError },
        "Failed to release availability hold - hold may require manual cleanup",
      );
    }
  }
};

/**
 * Let a booking past the blacklist, or refuse it (A05).
 *
 * The gate itself is older than this function and did the right thing: a
 * blacklisted guest could not be booked. What it did not have was a way
 * through. Its own message told the operator that "a GM override with
 * documented reason is required to proceed", and no such override existed
 * anywhere in the repo — no flag, no route, no record. In practice the way
 * past it was to clear `guests.is_blacklisted`, which does not document a
 * decision, it erases the listing for everyone who looks afterwards.
 *
 * Three things have to hold before the booking is taken, and they are checked
 * in this order on purpose:
 *
 * 1. The operator asked for the override explicitly. Without
 *    `blacklist_override` the refusal is what it always was.
 * 2. The reason code resolves, in the BLACKLIST category. An override filed
 *    under a room-move reason produces a trail that reads as a lie, which is
 *    the rule every other override in the product follows.
 * 3. The *acting* role clears the code's `approval_level`. This is the new
 *    part: until now a `force` flag on a payload was the entire mechanism, so
 *    an override was logged and never authorized. A code seeded at GM is
 *    enforced as OWNER, and a clerk who names it is refused rather than
 *    recorded.
 *
 * The row is written here, at the gate, rather than after the create
 * succeeds — matching how check-in records its forced reinstatement. The
 * decision to override was made and authorised at this point; a later failure
 * (an unavailable room, a closed restriction) leaves a record of a decision
 * that was genuinely taken, which is the safer way to be wrong about an
 * override.
 */
const clearBlacklistGate = async (
  tenantId: string,
  command: ReservationCreateCommand,
  reservationId: string,
  options: { correlationId?: string; actorId?: string; actorRole?: string },
): Promise<void> => {
  if (!command.blacklist_override) {
    throw new ReservationCommandError(
      "GUEST_BLACKLISTED",
      `Guest ${command.guest_id} is blacklisted. Reservation creation blocked. ` +
        "To proceed, set blacklist_override with a blacklist_override_reason_code " +
        "from the BLACKLIST reason codes — the override is recorded, and the code's " +
        "approval level is checked against your role.",
    );
  }

  // `?? ""` only satisfies the optional type: the command schema refuses a
  // blacklist_override with no reason code before this handler sees it.
  const reason = await resolveReasonCode(
    tenantId,
    command.property_id,
    command.blacklist_override_reason_code ?? "",
    "BLACKLIST",
  );

  assertOverrideAuthority(reason, options.actorRole, {
    commandName: "reservation.create",
    gateName: "blacklist_check",
  });

  await recordFlowApproval({
    tenantId,
    propertyId: command.property_id,
    flowName: "reservation",
    gateName: "blacklist_check",
    entityType: "reservation",
    entityId: reservationId,
    approvedBy: options.actorId ?? null,
    roleAtApproval: options.actorRole ?? SYSTEM_ACTOR_ROLE,
    forced: true,
    reasonCode: reason.reason_code,
    reasonNotes:
      command.blacklist_override_notes ??
      `${reason.reason_name}: booking taken for blacklisted guest ${command.guest_id}`,
    correlationId: options.correlationId ?? null,
  });

  reservationsLogger.warn(
    {
      tenantId,
      guestId: command.guest_id,
      reservationId,
      reasonCode: reason.reason_code,
      approvalLevel: reason.approval_level,
      actorRole: options.actorRole,
    },
    "blacklist gate overridden",
  );
};

/**
 * Accepts a reservation create command and enqueues its event payload
 * in the transactional outbox for asynchronous processing.
 */
export const createReservation = async (
  tenantId: string,
  command: ReservationCreateCommand,
  options: { correlationId?: string; actorId?: string; actorRole?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const stayStart = new Date(command.check_in_date);
  const stayEnd = new Date(command.check_out_date);

  // Validate check_out_date is after check_in_date
  if (stayEnd <= stayStart) {
    throw new Error("INVALID_DATES: check_out_date must be after check_in_date");
  }

  // A create with an explicit status is the other way around the transition
  // table: book the stay directly into CHECKED_OUT and no edge was ever
  // traversed. Only the states a booking can genuinely begin in are accepted —
  // CHECKED_IN among them, for the walk-in that has no prior state to move from.
  if (
    command.status !== undefined &&
    !RESERVATION_INITIAL_STATUSES.includes(command.status as ReservationStatus)
  ) {
    throw new ReservationCommandError(
      "INVALID_INITIAL_STATUS",
      `Cannot create a reservation in ${command.status}; must be ${describeReservationStatuses(RESERVATION_INITIAL_STATUSES)}`,
    );
  }

  // ── Gate: Guest blacklist check (Flow 3 → Flow 4 cross-flow gate) ──────
  // A blacklisted guest cannot create a reservation without explicit GM override.
  // This is the FIRST validation step per the master flow plan §3D/§4A.
  // Guest identity travels on the event: notification-service dispatches
  // BOOKING_CONFIRMED off reservation.created and cannot read the guests table,
  // so an absent address there means the EMAIL channel fails outright. Both
  // fields come off the blacklist row below rather than a second SELECT, so the
  // create hot path still makes exactly one guest query.
  let resolvedGuestName: string | undefined;
  let resolvedGuestEmail: string | undefined;

  if (command.guest_id) {
    const { rows: guestRows } = await query<{
      is_blacklisted: boolean;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>(
      `SELECT COALESCE(is_blacklisted, false) AS is_blacklisted,
              first_name,
              last_name,
              email
       FROM guests
       WHERE id = $1::uuid AND tenant_id = $2::uuid
       LIMIT 1`,
      [command.guest_id, tenantId],
    );
    if (guestRows[0]?.is_blacklisted) {
      await clearBlacklistGate(tenantId, command, command.reservation_id ?? eventId, options);
    }

    const guest = guestRows[0];
    if (guest) {
      const fullName = `${guest.first_name ?? ""} ${guest.last_name ?? ""}`.trim();
      resolvedGuestName = fullName === "" ? undefined : fullName;
      resolvedGuestEmail = guest.email ?? undefined;
    }
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

  // Expand the stay here as well as in the consumer. The consumer is what
  // writes the rows, but a plan that cannot expand — a night outside the
  // window, a duplicated date — should be refused while the caller is still on
  // the phone, not accepted with a 202 and dropped into a DLQ. It is also what
  // says how many rooms to lock.
  let stayPlan: ReturnType<typeof expandStayPlan>;
  try {
    stayPlan = expandStayPlan(
      {
        check_in_date: stayStart,
        check_out_date: stayEnd,
        room_type_id: command.room_type_id,
        guest_id: command.guest_id,
        currency: normalizedCurrency,
        rate_code: rateResolution.appliedRateCode,
        total_amount: command.total_amount,
      },
      command.rooms,
    );
  } catch (error) {
    if (error instanceof StayPlanError) {
      throw new ReservationCommandError(error.code, error.message);
    }
    throw error;
  }

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
      id: command.reservation_id ?? eventId,
      guest_name: resolvedGuestName,
      guest_email: resolvedGuestEmail,
      rate_code: rateResolution.appliedRateCode,
      check_in_date: stayStart,
      check_out_date: stayEnd,
      booking_date: command.booking_date ?? new Date(),
      total_amount: command.total_amount,
      currency: normalizedCurrency,
      status: command.status ?? "PENDING",
      source: command.source ?? "DIRECT",
      reservation_type: command.reservation_type ?? "TRANSIENT",
      cancellation_policy_snapshot: rateResolution.cancellationPolicySnapshot ?? null,
    },
  };

  const validatedEvent = ReservationCreatedEventSchema.parse(payload);
  const aggregateId = validatedEvent.payload.id ?? eventId;
  const partitionKey = validatedEvent.payload.guest_id ?? tenantId;

  // Restrictions are checked before any lock is taken. A refusal that has
  // already locked leaks inventory until the TTL expires, and a booking that
  // breaks min-LOS or a stop-sell should never have held a room at all.
  //
  // Each room is checked for its own type and window, so a multi-room booking
  // is refused if *any* of its rooms is unsellable — and `rooms_requested`
  // counts the rooms of that type, which is what a sell limit caps.
  const businessDate = await resolveBusinessDate(tenantId, command.property_id);

  const roomsByType = new Map<string, number>();
  for (const room of stayPlan.rooms) {
    roomsByType.set(room.room_type_id, (roomsByType.get(room.room_type_id) ?? 0) + 1);
  }
  for (const room of stayPlan.rooms) {
    await assertStaySellable({
      tenantId,
      propertyId: command.property_id,
      roomTypeId: room.room_type_id,
      rateId: rateResolution.rateId,
      channelCode: command.source ?? null,
      arrival: room.check_in_date,
      departure: room.check_out_date,
      bookingDate: businessDate,
      roomsRequested: roomsByType.get(room.room_type_id) ?? 1,
    });
  }

  // One lock per room held, not one per booking: a three-room reservation that
  // took a single lock would only ever hold one room's worth of inventory, and
  // the other two would oversell.
  //
  // Two rooms of the *same* type over the same dates come back CONFLICT from
  // the guard, which treats a room type as one exclusive resource rather than
  // counting it against rooms_to_sell. That predates this loop and the guard
  // does not gate a create either way — the status is recorded, not enforced.
  // Turning it into a real sellable ceiling is WS-02.
  const roomGuards: { roomSequence: number; guard: AvailabilityGuardMetadata }[] = [];
  for (const room of stayPlan.rooms) {
    const guard: AvailabilityGuardMetadata | undefined = await lockReservationHold({
      tenantId,
      propertyId: command.property_id,
      reservationId: aggregateId,
      roomTypeId: room.room_type_id,
      roomId: room.room_id ?? null,
      stayStart: room.check_in_date,
      stayEnd: room.check_out_date,
      reason: "RESERVATION_CREATE",
      correlationId: options.correlationId ?? eventId,
      idempotencyKey: roomLockKey(aggregateId, room.room_sequence),
    });
    roomGuards.push({
      roomSequence: room.room_sequence,
      guard: guard ?? { status: "SKIPPED" },
    });
  }

  // The reservation-level view stays the first room's, so lifecycle rows and
  // audit entries read the same as they did before multi-room.
  const guardMetadata: AvailabilityGuardMetadata =
    roomGuards[0]?.guard ?? ({ status: "SKIPPED" } as AvailabilityGuardMetadata);

  try {
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

      await recordAuditLog({
        tenantId,
        propertyId: command.property_id,
        actorId: options.actorId ?? SYSTEM_ACTOR_ID,
        action: "reservation.create",
        eventType: "CREATE",
        entityType: "reservation",
        entityId: aggregateId,
        metadata: {
          event_id: hashIdentifier(eventId),
          reservation_id: hashIdentifier(aggregateId),
          guest_id: command.guest_id ? hashIdentifier(command.guest_id) : null,
          status: command.status || "PENDING",
          redacted_payload: redactPayload(command),
          availabilityGuard: guardMetadata,
        },
      });

      for (const { roomSequence, guard } of roomGuards) {
        if (guard.status === "LOCKED" && guard.lockId) {
          await upsertReservationGuardMetadata(
            {
              tenantId,
              reservationId: aggregateId,
              roomSequence,
              lockId: guard.lockId,
              status: guard.status,
              metadata: guard,
            },
            client,
          );
        }
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
  } catch (txError) {
    // P1-2: Release every lock taken above on transaction failure, or a failed
    // multi-room create leaks one hold per room until their TTLs expire.
    for (const { guard } of roomGuards) {
      if (guard.status !== "LOCKED" || !guard.lockId) {
        continue;
      }
      try {
        await releaseReservationHold({
          tenantId,
          lockId: guard.lockId,
          reservationId: aggregateId,
          reason: "TRANSACTION_FAILURE_ROLLBACK",
          correlationId: options.correlationId ?? eventId,
        });
        reservationsLogger.info(
          { reservationId: aggregateId, lockId: guard.lockId },
          "Released availability lock after transaction failure",
        );
      } catch (releaseError) {
        reservationsLogger.error(
          { reservationId: aggregateId, lockId: guard.lockId, err: releaseError },
          "Failed to release availability lock after transaction failure — lock will expire via TTL",
        );
      }
    }
    throw txError;
  }

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
  options: { correlationId?: string; actorId?: string; actorRole?: string } = {},
): Promise<CreateReservationResult> => {
  const snapshot: ReservationStaySnapshot | null = await fetchReservationStaySnapshot(
    tenantId,
    command.reservation_id,
  );
  if (!snapshot) {
    throw new Error(`Reservation ${command.reservation_id} not found for tenant ${tenantId}`);
  }

  // A modify carrying a status is a lifecycle move wearing an edit's clothes,
  // and until the transition table existed this handler applied whatever it was
  // given. That made `reservation.modify` a way past every guard the dedicated
  // commands enforce — CHECKED_OUT straight back to CONFIRMED with no reversal,
  // CANCELLED to CHECKED_IN with no reinstatement, a folio left behind either
  // way — and `reservation.mass_update` rides the same handler, so it was that
  // 500 bookings at a time. The legal moves it still permits are the ones no
  // command of their own covers, chiefly PENDING → CONFIRMED when a deposit
  // lands. `force` is not consulted: an override has to leave a flow_approvals
  // row, and the command that writes one is the specific command.
  if (command.status !== undefined) {
    assertModifiableStatusChange(snapshot.status as ReservationStatus, command.status);
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

  // A modification that moves the stay has to clear the same gate a new
  // booking does — otherwise the restrictions can be walked around by booking
  // a legal stay and then editing it into an illegal one. Only when the stay
  // actually changed: re-checking an unrelated edit would refuse a guest's
  // name change because the dates they already hold are now closed.
  if (stayChanged) {
    await assertStaySellable({
      tenantId,
      propertyId: targetPropertyId,
      roomTypeId: targetRoomTypeId,
      rateId: rateResolution?.rateId,
      // The stay snapshot does not carry the booking channel, so a modify is
      // checked against every scope except CHANNEL. A channel-scoped rule
      // still bites on the original booking.
      channelCode: null,
      arrival: stayStart,
      departure: stayEnd,
      bookingDate: await resolveBusinessDate(tenantId, targetPropertyId),
    });
  }

  const guardMetadata: AvailabilityGuardMetadata = stayChanged
    ? await lockReservationHold({
        tenantId,
        propertyId: targetPropertyId,
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

  try {
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

      await recordAuditLog({
        tenantId,
        propertyId: targetPropertyId,
        actorId: options.actorId ?? SYSTEM_ACTOR_ID,
        action: "reservation.modify",
        eventType: "UPDATE",
        entityType: "reservation",
        entityId: command.reservation_id,
        metadata: {
          event_id: hashIdentifier(eventId),
          reservation_id: hashIdentifier(command.reservation_id),
          guest_id: command.guest_id
            ? hashIdentifier(command.guest_id)
            : hashIdentifier(snapshot.guestId),
          status: command.status || snapshot.status,
          redacted_payload: redactPayload(command),
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
  } catch (txError) {
    // P1-2: Release availability lock on transaction failure to prevent lock leak
    if (guardMetadata.status === "LOCKED" && guardMetadata.lockId) {
      try {
        await releaseReservationHold({
          tenantId,
          lockId: guardMetadata.lockId,
          reservationId: command.reservation_id,
          reason: "TRANSACTION_FAILURE_ROLLBACK",
          correlationId: options.correlationId ?? eventId,
        });
        reservationsLogger.info(
          { reservationId: command.reservation_id, lockId: guardMetadata.lockId },
          "Released availability lock after modify transaction failure",
        );
      } catch (releaseError) {
        reservationsLogger.error(
          {
            reservationId: command.reservation_id,
            lockId: guardMetadata.lockId,
            err: releaseError,
          },
          "Failed to release availability lock after modify transaction failure — lock will expire via TTL",
        );
      }
    }
    throw txError;
  }

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

/**
 * Mark a reservation as no-show.
 * PMS standard: guest did not arrive by the cutoff time.
 * Sets is_no_show, no_show_date, no_show_fee, status = NO_SHOW, releases room.
 */
export const markNoShow = async (
  tenantId: string,
  command: ReservationNoShowCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  // 1. Validate reservation exists and is eligible for no-show
  const resResult = await query(
    `SELECT id, status, room_number, room_rate, total_amount, guest_id
     FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = resResult.rows?.[0] as
    | {
        id: string;
        status: string;
        room_number: string | null;
        room_rate: number;
        total_amount: number;
        guest_id: string;
      }
    | undefined;

  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  assertReservationTransition(
    "reservation.no_show",
    reservation.status as ReservationStatus,
    "NO_SHOW",
    { code: "INVALID_STATUS_FOR_NO_SHOW" },
  );

  // 2. Calculate no-show fee (default to 1 night room rate if not specified)
  const noShowFee = command.no_show_fee ?? Number(reservation.room_rate ?? 0);

  // 3. Enqueue status update
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    status: "NO_SHOW",
    metadata: {
      ...command.metadata,
      is_no_show: true,
      no_show_date: new Date().toISOString(),
      no_show_fee: noShowFee,
      reason: command.reason ?? "Guest did not arrive",
    },
  };
  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.no_show",
    updatePayload,
    options,
  );

  // 4. Update no-show columns directly (event handler handles status/version)
  try {
    await query(
      `UPDATE reservations
       SET is_no_show = true,
           no_show_date = NOW(),
           no_show_fee = $3,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [command.reservation_id, tenantId, noShowFee],
    );
  } catch (err) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: err },
      "Failed to set no-show columns directly; event handler will process",
    );
  }

  // 5. Release room if assigned (best-effort)
  if (reservation.room_number) {
    try {
      await query(
        `UPDATE rooms SET status = 'AVAILABLE', version = version + 1, updated_at = NOW()
         WHERE room_number = $1 AND tenant_id = $2`,
        [reservation.room_number, tenantId],
      );
      reservationsLogger.info(
        { roomNumber: reservation.room_number },
        "Room released back to AVAILABLE on no-show",
      );
    } catch {
      // Non-critical
    }
  }

  reservationsLogger.info(
    { reservationId: command.reservation_id, noShowFee, reason: command.reason },
    "Reservation marked as NO_SHOW",
  );

  return result;
};

/**
 * S22: Batch no-show sweep.
 *
 * Finds all PENDING / CONFIRMED reservations whose check-in date has passed
 * for the given property and marks each as no-show by delegating to the
 * individual {@link markNoShow} handler. This ensures outbox events, room
 * releases, and fee calculations are applied consistently per reservation.
 *
 * @returns Summary of processed and failed reservation IDs.
 */
export const batchNoShowSweep = async (
  tenantId: string,
  command: ReservationBatchNoShowCommand,
  options: { correlationId?: string } = {},
): Promise<{ processed: string[]; failed: string[]; skipped: number }> => {
  const businessDate = command.business_date ?? new Date();

  // Find all eligible reservations for this property
  const { rows: candidates } = await query<{ id: string }>(
    `SELECT id
     FROM public.reservations
     WHERE tenant_id = $1::uuid
       AND property_id = $2::uuid
       AND status IN ('PENDING', 'CONFIRMED')
       AND check_in_date <= $3::date
       AND COALESCE(is_deleted, false) = false
       AND deleted_at IS NULL
     ORDER BY check_in_date ASC`,
    [tenantId, command.property_id, businessDate],
  );

  if (candidates.length === 0) {
    reservationsLogger.info(
      { propertyId: command.property_id, businessDate },
      "Batch no-show sweep: no eligible reservations found",
    );
    return { processed: [], failed: [], skipped: 0 };
  }

  // Dry-run mode: return candidates without processing
  if (command.dry_run) {
    reservationsLogger.info(
      { propertyId: command.property_id, count: candidates.length },
      "Batch no-show sweep dry-run: returning candidates without processing",
    );
    return { processed: [], failed: [], skipped: candidates.length };
  }

  const processed: string[] = [];
  const failed: string[] = [];

  for (const candidate of candidates) {
    try {
      await markNoShow(
        tenantId,
        {
          reservation_id: candidate.id,
          no_show_fee: command.no_show_fee_override,
          reason: command.reason ?? "Batch no-show sweep: guest did not arrive",
          metadata: command.metadata,
        },
        options,
      );
      processed.push(candidate.id);
    } catch (err) {
      reservationsLogger.warn(
        { reservationId: candidate.id, err },
        "Batch no-show sweep: failed to mark reservation as no-show",
      );
      failed.push(candidate.id);
    }
  }

  reservationsLogger.info(
    {
      propertyId: command.property_id,
      businessDate,
      total: candidates.length,
      processed: processed.length,
      failed: failed.length,
    },
    "Batch no-show sweep completed",
  );

  return { processed, failed, skipped: 0 };
};

/**
 * Cancel a reservation and release availability holds.
 * Calculates cancellation fee based on the rate's cancellation_policy.
 * Only PENDING or CONFIRMED reservations may be cancelled.
 */
export const cancelReservation = async (
  tenantId: string,
  command: ReservationCancelCommand,
  options: { correlationId?: string; actorId?: string; actorRole?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const now = new Date();

  // G5-cancel: Validate reservation status allows cancellation
  const resResult = await query(
    `SELECT id, status, property_id, guest_id FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = resResult.rows?.[0] as
    | {
        id: string;
        status: string;
        property_id: string;
        guest_id: string;
      }
    | undefined;
  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }
  // WAITLISTED joined the permitted set with the transition table: the screen
  // had always offered Cancel on a waiting booking and this handler had always
  // refused it. A guest who no longer wants to wait cancels.
  assertReservationTransition(
    "reservation.cancel",
    reservation.status as ReservationStatus,
    "CANCELLED",
    { code: "INVALID_STATUS_FOR_CANCEL" },
  );

  // Calculate cancellation fee from rate policy
  let cancellationFee = 0;
  try {
    const cancellationInfo = await fetchReservationCancellationInfo(
      tenantId,
      command.reservation_id,
    );
    if (cancellationInfo) {
      const feeResult = calculateCancellationFee(cancellationInfo, now);
      cancellationFee = feeResult.fee;
      reservationsLogger.info(
        {
          reservationId: command.reservation_id,
          policyType: feeResult.policyType,
          hoursUntilCheckIn: feeResult.hoursUntilCheckIn,
          policyDeadlineHours: feeResult.policyDeadlineHours,
          withinPenaltyWindow: feeResult.withinPenaltyWindow,
          cancellationFee,
        },
        "Cancellation fee calculated",
      );
    }
  } catch (feeError) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: feeError },
      "Failed to calculate cancellation fee; proceeding with fee = 0",
    );
  }

  const payload: ReservationCancelledEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.cancelled",
      timestamp: now.toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
    },
    payload: {
      id: command.reservation_id,
      tenant_id: tenantId,
      cancelled_at: now,
      cancelled_by: command.cancelled_by,
      reason: command.reason,
      cancellation_fee: cancellationFee > 0 ? cancellationFee : undefined,
    },
  };

  const validatedEvent = ReservationCancelledEventSchema.parse(payload);

  const guardRecords: StoredGuardMetadata[] = await listReservationGuardMetadata(
    tenantId,
    command.reservation_id,
  );
  const guardRecord: StoredGuardMetadata | null = guardRecords[0] ?? null;
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

    await recordAuditLog({
      tenantId,
      propertyId: reservation.property_id,
      actorId: options.actorId ?? SYSTEM_ACTOR_ID,
      action: "reservation.cancel",
      eventType: "UPDATE",
      entityType: "reservation",
      entityId: command.reservation_id,
      metadata: {
        event_id: hashIdentifier(eventId),
        reservation_id: hashIdentifier(command.reservation_id),
        guest_id: hashIdentifier(reservation.guest_id),
        reason: command.reason,
        cancelled_by: command.cancelled_by,
        cancellation_fee: cancellationFee,
        redacted_payload: redactPayload(command),
      },
    });

    for (const record of guardRecords) {
      await upsertReservationGuardMetadata(
        {
          tenantId,
          reservationId: command.reservation_id,
          roomSequence: record.roomSequence,
          lockId: record.lockId ?? releaseLockId,
          status: "RELEASE_REQUESTED",
          metadata: {
            previousStatus: record.status,
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

  // Release availability holds AFTER transaction succeeds — one per room held.
  // If this fails, the reservation is cancelled but the hold remains (safer
  // than the reverse).
  await releaseAllReservationHolds({
    tenantId,
    reservationId: command.reservation_id,
    records: guardRecords,
    fallbackLockId: releaseLockId,
    reason: command.reason ?? "RESERVATION_CANCEL",
    correlationId: options.correlationId ?? eventId,
  });

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
  };
};

// ─── S11: Walk Guest ─────────────────────────────────────────────────────────

/**
 * Walk a guest due to overbooking.
 * Creates a walk_history record, transitions the reservation to CANCELLED with
 * walk-specific metadata, and releases any availability holds.
 */
export const walkGuest = async (
  tenantId: string,
  command: ReservationWalkGuestCommand,
  options: { correlationId?: string; actorId?: string; actorRole?: string } = {},
): Promise<CreateReservationResult> => {
  const actorId = options.actorId ?? SYSTEM_ACTOR_ID;
  const eventId = uuid();
  const now = new Date();

  // 1. Fetch reservation
  const result = await query<{
    id: string;
    status: string;
    property_id: string;
    guest_id: string;
    guest_name: string;
    confirmation_number: string;
    room_type_id: string;
    room_number: string | null;
  }>(
    `SELECT id, status, property_id, guest_id, guest_name,
            confirmation_number, room_type_id, room_number
     FROM reservations
     WHERE id = $1::uuid AND tenant_id = $2::uuid
       AND COALESCE(is_deleted, false) = false`,
    [command.reservation_id, tenantId],
  );

  const reservation = result.rows[0];
  if (!reservation) {
    throw new ReservationCommandError(
      "NOT_FOUND",
      `Reservation ${command.reservation_id} not found.`,
    );
  }

  // Walking a guest cancels their booking here and rebooks them elsewhere, so
  // it clears the same gate as a cancel — minus INQUIRY/QUOTED/WAITLISTED,
  // which have no room held to be walked out of.
  assertReservationTransition(
    "reservation.walk_guest",
    reservation.status as ReservationStatus,
    "CANCELLED",
    { code: "INVALID_STATUS" },
  );

  // Build the cancelled event envelope (same shape as cancelReservation)
  const payload: ReservationCancelledEvent = {
    metadata: {
      id: eventId,
      source: serviceConfig.serviceId,
      type: "reservation.cancelled",
      timestamp: now.toISOString(),
      version: "1.0",
      correlationId: options.correlationId,
      tenantId,
      retryCount: 0,
    },
    payload: {
      id: command.reservation_id,
      tenant_id: tenantId,
      cancelled_at: now,
      cancelled_by: actorId,
      reason: `WALKED: ${command.walk_reason ?? "Overbooking"}`,
    },
  };
  const validatedEvent = ReservationCancelledEventSchema.parse(payload);

  // Look up guard metadata for lock release
  const guardRecords: StoredGuardMetadata[] = await listReservationGuardMetadata(
    tenantId,
    command.reservation_id,
  );
  const guardRecord: StoredGuardMetadata | null = guardRecords[0] ?? null;
  const releaseLockId = guardRecord?.lockId ?? command.reservation_id;

  await withTransaction(async (client) => {
    // 2. Create walk_history record
    await client.query(
      `INSERT INTO walk_history (
         tenant_id, property_id, reservation_id, confirmation_number,
         guest_name, guest_id, walk_date, walk_reason, walked_by,
         alternate_hotel_name, alternate_hotel_address, alternate_hotel_phone,
         alternate_confirmation, alternate_rate, alternate_nights,
         compensation_type, compensation_amount, compensation_currency,
         compensation_description,
         transportation_provided, transportation_type, transportation_cost,
         return_guaranteed, return_date, return_room_type,
         walk_status, notes,
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4,
         $5, $6::uuid, CURRENT_DATE, $7, $8::uuid,
         $9, $10, $11,
         $12, $13, $14,
         $15, $16, 'USD',
         $17,
         $18, $19, $20,
         $21, $22, $23,
         'initiated', $24,
         $8::uuid, $8::uuid
       )`,
      [
        tenantId,
        reservation.property_id,
        command.reservation_id,
        reservation.confirmation_number,
        reservation.guest_name,
        reservation.guest_id,
        command.walk_reason ?? null,
        actorId,
        command.alternate_hotel_name ?? null,
        command.alternate_hotel_address ?? null,
        command.alternate_hotel_phone ?? null,
        command.alternate_confirmation ?? null,
        command.alternate_rate ?? null,
        command.alternate_nights ?? 1,
        command.compensation_type ?? null,
        command.compensation_amount ?? 0,
        command.compensation_description ?? null,
        command.transportation_provided ?? false,
        command.transportation_type ?? null,
        command.transportation_cost ?? 0,
        command.return_guaranteed ?? false,
        command.return_date ? new Date(command.return_date).toISOString().slice(0, 10) : null,
        command.return_room_type ?? null,
        command.notes ?? null,
      ],
    );

    await recordAuditLog({
      tenantId,
      propertyId: reservation.property_id,
      actorId,
      action: "reservation.walk_guest",
      eventType: "UPDATE",
      entityType: "reservation",
      entityId: command.reservation_id,
      metadata: {
        event_id: hashIdentifier(eventId),
        reservation_id: hashIdentifier(command.reservation_id),
        guest_id: hashIdentifier(reservation.guest_id),
        walk_reason: command.walk_reason,
        alternate_hotel: command.alternate_hotel_name,
        redacted_payload: redactPayload(command),
      },
    });

    // 3. Cancel the reservation with walk metadata
    await client.query(
      `UPDATE reservations
       SET status = 'CANCELLED',
           cancellation_date = NOW(),
           cancellation_reason = $3,
           metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
           updated_at = NOW(), updated_by = $5,
           version = version + 1
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [
        command.reservation_id,
        tenantId,
        `WALKED: ${command.walk_reason ?? "Overbooking"}`,
        JSON.stringify({
          walked: true,
          walk_date: now.toISOString().slice(0, 10),
          alternate_hotel: command.alternate_hotel_name ?? null,
          compensation_amount: command.compensation_amount ?? 0,
        }),
        actorId,
      ],
    );

    // 4. Mark every room's hold for release
    for (const record of guardRecords) {
      await upsertReservationGuardMetadata(
        {
          tenantId,
          reservationId: command.reservation_id,
          roomSequence: record.roomSequence,
          lockId: record.lockId ?? releaseLockId,
          status: "RELEASE_REQUESTED",
          metadata: {
            previousStatus: record.status,
            reason: "WALK_GUEST",
          },
        },
        client,
      );
    }

    // 5. Emit reservation.cancelled event via outbox
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
        action: "walk_guest",
        availabilityGuard: {
          status: "RELEASE_REQUESTED",
          lockId: releaseLockId,
        },
      },
    });
  });

  // 6. Release every room's hold (best-effort, outside transaction)
  await releaseAllReservationHolds({
    tenantId,
    reservationId: command.reservation_id,
    records: guardRecords,
    fallbackLockId: releaseLockId,
    reason: "WALK_GUEST",
    correlationId: options.correlationId ?? eventId,
  });

  reservationsLogger.info(
    {
      reservationId: command.reservation_id,
      guestName: reservation.guest_name,
      alternateHotel: command.alternate_hotel_name,
      compensationAmount: command.compensation_amount,
    },
    "Guest walked due to overbooking",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};
