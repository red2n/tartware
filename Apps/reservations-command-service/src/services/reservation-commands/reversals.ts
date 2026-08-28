/**
 * DEV DOC
 * Module: reservation-commands/reversals.ts
 * Purpose: Undo a check-in, a check-out, or a cancellation.
 * Ownership: reservations-command-service
 *
 * Until now there was no way to undo any of the three. On a busy arrival day
 * the only recovery from a mis-key was direct database work on a live system.
 *
 * The rule every reversal here follows: **put back exactly what the operation
 * being reversed did, and nothing else.** Check-in posts an early check-in fee,
 * so reversing it voids that fee. Check-in does not post the guest's dinner, so
 * reversing it does not void the guest's dinner — it refuses instead, and says
 * why. A reversal that leaves a posting behind is bad; one that silently voids
 * charges it never created is worse, because nobody notices.
 *
 * That rule is what makes the balance assertion true: reverse a check-in and
 * the folio balance is what it was before the check-in, to the cent.
 */

import type {
  ReasonCodeRow,
  ReservationReinstateCommand,
  ReservationReversalFolioRow,
  ReservationReversalPostingRow,
  ReservationReversalStateRow,
  ReservationReverseCheckInCommand,
  ReservationReverseCheckOutCommand,
} from "@tartware/schemas";
import {
  ReservationReinstateCommandSchema,
  ReservationReverseCheckInCommandSchema,
  ReservationReverseCheckOutCommandSchema,
} from "@tartware/schemas";
import type { PoolClient } from "pg";

import { lockReservationHold } from "../../clients/availability-guard-client.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { recordAuditLog, recordFlowApproval } from "../../utils/audit.js";

import {
  type CreateReservationResult,
  enqueueReservationUpdate,
  ReservationCommandError,
  type ReservationUpdatePayload,
  resolveReasonCode,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Charge codes each operation posts, and therefore owns on the way back.
 *
 * Deliberately explicit rather than derived. If check-in gains a new automatic
 * posting, this list is the one place that has to learn about it — and a
 * reversal that does not know about it will refuse loudly rather than leave the
 * charge stranded on a folio nobody is looking at any more.
 */
export const OWNED_CHARGE_CODES = {
  CHECK_IN: ["EARLY_CHECKIN"],
  CHECK_OUT: ["LATE_CHECKOUT"],
  CANCEL: ["CANCELLATION_FEE", "CANCELLATION_PENALTY"],
} as const;

type ReversalKind = keyof typeof OWNED_CHARGE_CODES;

/** Coerce a NUMERIC-as-string to a number without inventing a value. */
const toAmount = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// ---------------------------------------------------------------------------
// Reason codes
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Folio and postings
// ---------------------------------------------------------------------------

/** The folio a reversal has to put back, if the reservation has one. */
const loadFolio = async (
  tenantId: string,
  reservationId: string,
): Promise<ReservationReversalFolioRow | null> => {
  const result = await query<ReservationReversalFolioRow>(
    `SELECT folio_id, folio_number, folio_status, balance,
            total_charges, total_payments, currency_code, settled_at
       FROM public.folios
      WHERE reservation_id = $1::uuid
        AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      ORDER BY created_at DESC
      LIMIT 1`,
    [reservationId, tenantId],
  );
  return result.rows[0] ?? null;
};

/** Live (unvoided) postings on a folio. */
const loadPostings = async (
  tenantId: string,
  folioId: string,
): Promise<ReservationReversalPostingRow[]> => {
  const result = await query<ReservationReversalPostingRow>(
    `SELECT posting_id, charge_code, charge_description, total_amount,
            tax_amount, posting_date, is_voided
       FROM public.charge_postings
      WHERE folio_id = $1::uuid
        AND tenant_id = $2::uuid
        AND COALESCE(is_voided, false) = false
        AND COALESCE(is_deleted, false) = false
      ORDER BY posting_date ASC`,
    [folioId, tenantId],
  );
  return result.rows;
};

/**
 * Void one posting and take its money back off the folio, in one transaction.
 *
 * The folio update mirrors exactly how the charge was applied when it was
 * posted, so the arithmetic is reversible rather than recomputed — a recompute
 * would quietly "fix" a folio that was already wrong for some other reason, and
 * hide the real problem.
 */
const voidPosting = async (
  client: PoolClient,
  input: {
    tenantId: string;
    folioId: string;
    posting: ReservationReversalPostingRow;
    reasonCode: string;
    actorId: string;
  },
): Promise<number> => {
  const amount = toAmount(input.posting.total_amount);

  await client.query(
    `UPDATE public.charge_postings
        SET is_voided = true,
            voided_at = NOW(),
            voided_by = $3::uuid,
            void_reason = $4,
            updated_at = NOW(),
            updated_by = $3::uuid
      WHERE posting_id = $1::uuid
        AND tenant_id = $2::uuid
        AND COALESCE(is_voided, false) = false`,
    [input.posting.posting_id, input.tenantId, input.actorId, input.reasonCode],
  );

  await client.query(
    `UPDATE public.folios
        SET total_charges = total_charges - $2,
            balance = balance - $2,
            version = version + 1,
            updated_at = NOW()
      WHERE folio_id = $1::uuid
        AND tenant_id = $3::uuid`,
    [input.folioId, amount, input.tenantId],
  );

  return amount;
};

/**
 * Decide whether the reversal may touch this folio, and which postings it owns.
 *
 * Refuses when live postings exist that the reversed operation did not create,
 * unless the caller passed `force`. That refusal is the whole safety property:
 * it is what stops "undo check-in" from wiping a guest's bar tab.
 */
export const partitionPostings = (
  postings: ReservationReversalPostingRow[],
  kind: ReversalKind,
): { owned: ReservationReversalPostingRow[]; foreign: ReservationReversalPostingRow[] } => {
  const owned: ReservationReversalPostingRow[] = [];
  const foreign: ReservationReversalPostingRow[] = [];
  const ownedCodes: readonly string[] = OWNED_CHARGE_CODES[kind];

  for (const posting of postings) {
    if (ownedCodes.includes(posting.charge_code?.toUpperCase() ?? "")) {
      owned.push(posting);
    } else {
      foreign.push(posting);
    }
  }
  return { owned, foreign };
};

/** Result of putting a folio back. */
type FolioReversalOutcome = {
  folioId: string | null;
  voidedPostings: number;
  amountReversed: number;
  folioReopened: boolean;
  balanceBefore: number;
  balanceAfter: number;
};

/**
 * Put the folio back: void what the operation posted, and reopen it if the
 * operation closed it.
 */
const reverseFolioSideEffects = async (input: {
  tenantId: string;
  reservationId: string;
  kind: ReversalKind;
  reasonCode: string;
  actorId: string;
  force: boolean;
  reopenFolio: boolean;
}): Promise<FolioReversalOutcome> => {
  const folio = await loadFolio(input.tenantId, input.reservationId);
  if (!folio) {
    return {
      folioId: null,
      voidedPostings: 0,
      amountReversed: 0,
      folioReopened: false,
      balanceBefore: 0,
      balanceAfter: 0,
    };
  }

  const postings = await loadPostings(input.tenantId, folio.folio_id);
  const { owned, foreign } = partitionPostings(postings, input.kind);

  if (foreign.length > 0 && !input.force) {
    const sample = foreign
      .slice(0, 3)
      .map((p) => `${p.charge_code} ${toAmount(p.total_amount)}`)
      .join(", ");
    throw new ReservationCommandError(
      "FOLIO_HAS_OTHER_CHARGES",
      `Folio ${folio.folio_number} carries ${foreign.length} charge(s) this reversal did not post ` +
        `(${sample}${foreign.length > 3 ? ", …" : ""}). ` +
        `Void or transfer them first, or pass force=true to reverse anyway and leave them in place.`,
    );
  }

  const balanceBefore = toAmount(folio.balance);
  let amountReversed = 0;
  let folioReopened = false;

  await withTransaction(async (client) => {
    for (const posting of owned) {
      amountReversed += await voidPosting(client, {
        tenantId: input.tenantId,
        folioId: folio.folio_id,
        posting,
        reasonCode: input.reasonCode,
        actorId: input.actorId,
      });
    }

    // Check-out settles the folio; reversing check-out has to unsettle it, or
    // the guest is back in-house with a closed folio and nothing can post.
    if (input.reopenFolio && folio.folio_status.toUpperCase() !== "OPEN") {
      await client.query(
        `UPDATE public.folios
            SET folio_status = 'OPEN',
                settled_at = NULL,
                settled_by = NULL,
                settlement_method = NULL,
                closed_at = NULL,
                close_reason = NULL,
                version = version + 1,
                updated_at = NOW()
          WHERE folio_id = $1::uuid
            AND tenant_id = $2::uuid`,
        [folio.folio_id, input.tenantId],
      );
      folioReopened = true;
    }
  });

  return {
    folioId: folio.folio_id,
    voidedPostings: owned.length,
    amountReversed,
    folioReopened,
    balanceBefore,
    balanceAfter: balanceBefore - amountReversed,
  };
};

// ---------------------------------------------------------------------------
// Shared preamble
// ---------------------------------------------------------------------------

/** Load the reservation, or refuse. */
const loadReservation = async (
  tenantId: string,
  reservationId: string,
): Promise<ReservationReversalStateRow> => {
  const result = await query<ReservationReversalStateRow>(
    `SELECT id, tenant_id, property_id, status, guest_id, room_type_id, room_number,
            check_in_date, check_out_date, actual_check_in, actual_check_out,
            cancellation_date, cancellation_fee, total_amount, currency
       FROM public.reservations
      WHERE id = $1::uuid AND tenant_id = $2::uuid
      LIMIT 1`,
    [reservationId, tenantId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${reservationId} not found`,
    );
  }
  return row;
};

/** Refuse a reversal against a reservation that is not in the reversible state. */
const requireStatus = (
  reservation: ReservationReversalStateRow,
  expected: string,
  code: string,
): void => {
  if (reservation.status !== expected) {
    throw new ReservationCommandError(
      code,
      `Cannot reverse: reservation is ${reservation.status}, must be ${expected}`,
    );
  }
};

/** Put a room back to the status the operator asked for. Best-effort, like check-in. */
const setRoomStatus = async (
  tenantId: string,
  roomNumber: string | null,
  propertyId: string | null,
  status: string,
  reservationId: string,
): Promise<void> => {
  if (!roomNumber || !propertyId) return;
  try {
    await query(
      `UPDATE public.rooms
          SET status = $1, version = version + 1, updated_at = NOW()
        WHERE room_number = $2
          AND property_id = $3::uuid
          AND tenant_id = $4::uuid`,
      [status, roomNumber, propertyId, tenantId],
    );
  } catch (error) {
    reservationsLogger.warn(
      { reservationId, roomNumber, status, error },
      "Failed to restore room status during reversal — manual update required",
    );
  }
};

/**
 * Record the reversal twice, on purpose.
 *
 * `flow_approvals` is where operational overrides live and is what an operations
 * lead reads; `audit_logs` is the compliance trail. A reversal is both, and the
 * two are read by different people for different reasons.
 */
const recordReversal = async (input: {
  tenantId: string;
  propertyId: string | null;
  reservationId: string;
  gateName: string;
  reason: ReasonCodeRow;
  reasonNotes?: string;
  actorId?: string;
  correlationId?: string;
  forced: boolean;
  outcome: FolioReversalOutcome;
  previousStatus: string;
  newStatus: string;
}): Promise<void> => {
  await recordFlowApproval({
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    flowName: "reservation_reversal",
    gateName: input.gateName,
    entityType: "reservation",
    entityId: input.reservationId,
    approvedBy: input.actorId ?? null,
    roleAtApproval: input.forced ? "FORCE_OVERRIDE" : "REVERSAL",
    reasonCode: input.reason.reason_code,
    reasonNotes:
      input.reasonNotes ??
      `${input.reason.reason_name}: ${input.previousStatus} → ${input.newStatus}`,
    correlationId: input.correlationId ?? null,
  });

  await recordAuditLog({
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    actorId: input.actorId ?? SYSTEM_ACTOR_ID,
    action: input.gateName.toUpperCase(),
    eventType: "RESERVATION_REVERSAL",
    entityType: "reservation",
    entityId: input.reservationId,
    metadata: {
      description:
        `Reversal ${input.gateName}: ${input.previousStatus} → ${input.newStatus}, ` +
        `reason ${input.reason.reason_code}`,
      reason_code: input.reason.reason_code,
      reason_notes: input.reasonNotes,
      forced: input.forced,
      correlation_id: input.correlationId,
      folio_id: input.outcome.folioId,
      voided_postings: input.outcome.voidedPostings,
      amount_reversed: input.outcome.amountReversed,
      // The pair that makes the reversal auditable without re-deriving it.
      balance_before: input.outcome.balanceBefore,
      balance_after: input.outcome.balanceAfter,
      folio_reopened: input.outcome.folioReopened,
    },
  });
};

// ---------------------------------------------------------------------------
// reservation.reverse_check_in — PMS-02-01
// ---------------------------------------------------------------------------

/**
 * Undo a check-in.
 *
 * The reservation goes back to CONFIRMED with `actual_check_in` and the room
 * assignment cleared, the room goes back to the requested status, and the
 * early check-in fee — the only thing check-in posts — is voided.
 *
 * **A no-show reinstated by a forced check-in does not go back to NO_SHOW.**
 * Check-in clears the no-show marks deliberately, and re-marking a guest as a
 * no-show is a financial decision with its own command, not a side effect of
 * undoing a keystroke.
 */
export const reverseCheckIn = async (
  tenantId: string,
  rawCommand: ReservationReverseCheckInCommand,
  options: { correlationId?: string; actorId?: string } = {},
): Promise<CreateReservationResult> => {
  // Parsed here as well as in the consumer: the schema defaults are load-bearing
  // (see `restore_status` / `room_status_after`), and a handler that inherited
  // them from its caller would silently no-op when called unparsed.
  const input = ReservationReverseCheckInCommandSchema.parse(rawCommand);
  const reservation = await loadReservation(tenantId, input.reservation_id);
  requireStatus(reservation, "CHECKED_IN", "INVALID_STATUS_FOR_REVERSE_CHECKIN");

  const propertyId = reservation.property_id ?? input.property_id ?? null;
  const reason = await resolveReasonCode(tenantId, propertyId, input.reason_code, "REVERSAL");

  const outcome = await reverseFolioSideEffects({
    tenantId,
    reservationId: input.reservation_id,
    kind: "CHECK_IN",
    reasonCode: input.reason_code,
    actorId: options.actorId ?? SYSTEM_ACTOR_ID,
    force: Boolean(input.force),
    reopenFolio: false,
  });

  const updatePayload: ReservationUpdatePayload = {
    id: input.reservation_id,
    tenant_id: tenantId,
    status: "CONFIRMED",
    // null, not undefined: undefined means "leave it", which would leave the
    // reservation reading as checked in at a time it never was.
    actual_check_in: null,
    room_number: null,
    metadata: {
      ...input.metadata,
      reversal: {
        kind: "REVERSE_CHECK_IN",
        reason_code: input.reason_code,
        reversed_at: new Date().toISOString(),
        previous_room_number: reservation.room_number,
      },
    },
  };

  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.reverse_check_in",
    updatePayload,
    options,
  );

  await setRoomStatus(
    tenantId,
    reservation.room_number,
    propertyId,
    input.room_status_after,
    input.reservation_id,
  );

  await recordReversal({
    tenantId,
    propertyId,
    reservationId: input.reservation_id,
    gateName: "reverse_check_in",
    reason,
    reasonNotes: input.reason_notes,
    actorId: options.actorId,
    correlationId: options.correlationId,
    forced: Boolean(input.force),
    outcome,
    previousStatus: "CHECKED_IN",
    newStatus: "CONFIRMED",
  });

  reservationsLogger.info(
    {
      reservationId: input.reservation_id,
      reasonCode: input.reason_code,
      voidedPostings: outcome.voidedPostings,
      balanceBefore: outcome.balanceBefore,
      balanceAfter: outcome.balanceAfter,
      roomStatus: input.room_status_after,
    },
    "Check-in reversed",
  );

  return result;
};

// ---------------------------------------------------------------------------
// reservation.reverse_check_out — PMS-02-14
// ---------------------------------------------------------------------------

/**
 * Undo a check-out.
 *
 * The guest is back in-house: status returns to CHECKED_IN, the room returns to
 * OCCUPIED, `actual_check_out` is cleared, and the folio is reopened so charges
 * can post again.
 *
 * **Refuses when a forced check-out moved the balance to the city ledger.**
 * That transfer created an AR row with its own lifecycle; silently reversing it
 * from here would leave accounts receivable and the folio disagreeing about who
 * owes what, and AR is reconciled by a different team on a different schedule.
 */
export const reverseCheckOut = async (
  tenantId: string,
  rawCommand: ReservationReverseCheckOutCommand,
  options: { correlationId?: string; actorId?: string } = {},
): Promise<CreateReservationResult> => {
  const input = ReservationReverseCheckOutCommandSchema.parse(rawCommand);
  const reservation = await loadReservation(tenantId, input.reservation_id);
  requireStatus(reservation, "CHECKED_OUT", "INVALID_STATUS_FOR_REVERSE_CHECKOUT");

  const propertyId = reservation.property_id ?? input.property_id ?? null;
  const reason = await resolveReasonCode(tenantId, propertyId, input.reason_code, "REVERSAL");

  const openArResult = await query<{ ar_id: string; ar_number: string }>(
    `SELECT ar_id, ar_number
       FROM public.accounts_receivable
      WHERE reservation_id = $1::uuid
        AND tenant_id = $2::uuid
        AND account_type = 'city_ledger'
        AND ar_status NOT IN ('paid', 'written_off', 'cancelled')
        AND COALESCE(is_deleted, false) = false
      LIMIT 1`,
    [input.reservation_id, tenantId],
  );

  if (openArResult.rows.length > 0 && !input.force) {
    const ar = openArResult.rows[0];
    throw new ReservationCommandError(
      "CHECKOUT_BALANCE_IN_AR",
      `Check-out moved this folio's balance to city ledger ${ar?.ar_number}. ` +
        `Settle or reverse the AR entry first, or pass force=true to reverse the ` +
        `check-out and leave the receivable standing.`,
    );
  }

  const outcome = await reverseFolioSideEffects({
    tenantId,
    reservationId: input.reservation_id,
    kind: "CHECK_OUT",
    reasonCode: input.reason_code,
    actorId: options.actorId ?? SYSTEM_ACTOR_ID,
    force: Boolean(input.force),
    reopenFolio: true,
  });

  const updatePayload: ReservationUpdatePayload = {
    id: input.reservation_id,
    tenant_id: tenantId,
    status: "CHECKED_IN",
    actual_check_out: null,
    metadata: {
      ...input.metadata,
      reversal: {
        kind: "REVERSE_CHECK_OUT",
        reason_code: input.reason_code,
        reversed_at: new Date().toISOString(),
      },
    },
  };

  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.reverse_check_out",
    updatePayload,
    options,
  );

  await setRoomStatus(
    tenantId,
    reservation.room_number,
    propertyId,
    input.room_status_after,
    input.reservation_id,
  );

  await recordReversal({
    tenantId,
    propertyId,
    reservationId: input.reservation_id,
    gateName: "reverse_check_out",
    reason,
    reasonNotes: input.reason_notes,
    actorId: options.actorId,
    correlationId: options.correlationId,
    forced: Boolean(input.force),
    outcome,
    previousStatus: "CHECKED_OUT",
    newStatus: "CHECKED_IN",
  });

  reservationsLogger.info(
    {
      reservationId: input.reservation_id,
      reasonCode: input.reason_code,
      folioReopened: outcome.folioReopened,
      voidedPostings: outcome.voidedPostings,
    },
    "Check-out reversed",
  );

  return result;
};

// ---------------------------------------------------------------------------
// reservation.reinstate — PMS-01-20
// ---------------------------------------------------------------------------

/**
 * Reinstate a cancelled reservation.
 *
 * Unlike the other two reversals this one can legitimately fail, and the
 * failure is the point: cancelling released the nights, and they may have been
 * sold since. The availability hold is re-acquired **before** the status
 * changes, so a reinstatement that cannot get its inventory back leaves the
 * reservation cancelled rather than creating an overbooking.
 */
export const reinstateReservation = async (
  tenantId: string,
  rawCommand: ReservationReinstateCommand,
  options: { correlationId?: string; actorId?: string } = {},
): Promise<CreateReservationResult> => {
  const input = ReservationReinstateCommandSchema.parse(rawCommand);
  const reservation = await loadReservation(tenantId, input.reservation_id);
  requireStatus(reservation, "CANCELLED", "INVALID_STATUS_FOR_REINSTATE");

  const propertyId = reservation.property_id ?? input.property_id ?? null;
  const reason = await resolveReasonCode(tenantId, propertyId, input.reason_code, "REVERSAL");

  // Inventory first. Everything below this point assumes the nights are held.
  if (propertyId && reservation.room_type_id) {
    const hold = await lockReservationHold({
      tenantId,
      propertyId,
      reservationId: input.reservation_id,
      roomTypeId: reservation.room_type_id,
      stayStart: new Date(reservation.check_in_date),
      stayEnd: new Date(reservation.check_out_date),
      reason: `Reinstatement (${input.reason_code})`,
      correlationId: options.correlationId,
    });

    if (hold.status === "CONFLICT") {
      throw new ReservationCommandError(
        "REINSTATE_NO_INVENTORY",
        `Cannot reinstate: the nights released by the cancellation have been sold. ` +
          `The booking stays cancelled.`,
      );
    }

    // ERROR is not CONFLICT. The guard could not answer, which is not the same
    // as saying yes — and unlike a fresh booking, a reinstatement is never
    // urgent enough to justify risking an overbooking on a shrug. The operator
    // can still force it, deliberately and on the record.
    if (hold.status === "ERROR" && !input.force) {
      throw new ReservationCommandError(
        "REINSTATE_GUARD_UNAVAILABLE",
        `Cannot confirm the nights are still available — the availability guard ` +
          `returned ERROR${hold.message ? ` (${hold.message})` : ""}. ` +
          `Retry, or pass force=true to reinstate without the check.`,
      );
    }
  }

  const outcome = await reverseFolioSideEffects({
    tenantId,
    reservationId: input.reservation_id,
    kind: "CANCEL",
    reasonCode: input.reason_code,
    actorId: options.actorId ?? SYSTEM_ACTOR_ID,
    force: Boolean(input.force),
    reopenFolio: true,
  });

  const updatePayload: ReservationUpdatePayload = {
    id: input.reservation_id,
    tenant_id: tenantId,
    status: input.restore_status,
    metadata: {
      ...input.metadata,
      reversal: {
        kind: "REINSTATE",
        reason_code: input.reason_code,
        reversed_at: new Date().toISOString(),
        previous_cancellation_fee: toAmount(reservation.cancellation_fee),
      },
    },
  };

  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.reinstate",
    updatePayload,
    options,
  );

  // The cancellation marks are columns the update payload does not carry, so
  // they are cleared here. Left in place, the reinstated booking reads as
  // cancelled to every report that filters on cancellation_date.
  try {
    await query(
      `UPDATE public.reservations
          SET cancellation_date = NULL,
              cancellation_reason = NULL,
              cancellation_fee = NULL,
              version = version + 1,
              updated_at = NOW()
        WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [input.reservation_id, tenantId],
    );
  } catch (error) {
    reservationsLogger.warn(
      { reservationId: input.reservation_id, error },
      "Failed to clear cancellation marks on reinstatement",
    );
  }

  await recordReversal({
    tenantId,
    propertyId,
    reservationId: input.reservation_id,
    gateName: "reinstate_reservation",
    reason,
    reasonNotes: input.reason_notes,
    actorId: options.actorId,
    correlationId: options.correlationId,
    forced: Boolean(input.force),
    outcome,
    previousStatus: "CANCELLED",
    newStatus: input.restore_status,
  });

  reservationsLogger.info(
    {
      reservationId: input.reservation_id,
      reasonCode: input.reason_code,
      restoreStatus: input.restore_status,
      voidedPostings: outcome.voidedPostings,
    },
    "Reservation reinstated",
  );

  return result;
};
