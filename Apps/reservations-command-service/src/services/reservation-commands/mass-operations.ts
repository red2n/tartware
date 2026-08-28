import type { BatchRunContext } from "@tartware/command-consumer-utils/batch";
import { runBatchCommand } from "@tartware/command-consumer-utils/batch";
import { createBatchResultStore } from "@tartware/command-consumer-utils/batch-repository";
import type {
  BatchCommandResult,
  ReservationMassCancelCommand,
  ReservationMassCheckInCommand,
  ReservationMassUpdateCommand,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import { pool, query } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { checkInReservation } from "./checkin-checkout.js";
import { ReservationCommandError } from "./common.js";
import { cancelReservation, modifyReservation } from "./core.js";

/**
 * Mass operations (WS-04) — mass cancel, mass check-in and mass update.
 *
 * Each one is the single command applied to many targets, and nothing else.
 * The per-item work is `cancelReservation`, `checkInReservation` and
 * `modifyReservation` verbatim, so a rule added to one of those — a status
 * guard, a fee policy, a deposit block — reaches the mass path the same day
 * without anyone remembering to copy it. That is the whole reason these are
 * eight-line handlers around a shared runner rather than three bulk loops.
 */

const logger = reservationsLogger.child({ module: "mass-operations" });

const store = createBatchResultStore(pool);

type CommandOptions = { correlationId?: string; actorId?: string; actorRole?: string };

const buildContext = (
  tenantId: string,
  commandName: string,
  command: { batch_id?: string; property_id?: string },
  options: CommandOptions,
): BatchRunContext => ({
  tenantId,
  commandName,
  batchId: command.batch_id ?? uuid(),
  propertyId: command.property_id,
  correlationId: options.correlationId,
  actorId: options.actorId,
});

/**
 * Confirm a reservation exists and report its status, without changing it.
 *
 * This is the dry-run validator the three commands share. It deliberately
 * checks less than the handler does: it answers "is this id one of mine", which
 * is the question a mistyped batch actually gets wrong, and it cannot answer
 * "would the status guard pass" without racing the real run anyway.
 */
const resolveReservation = async (
  tenantId: string,
  reservationId: string,
): Promise<{ targetId: string; status: string }> => {
  const { rows } = await query<{ id: string; status: string }>(
    `SELECT id, status
       FROM public.reservations
      WHERE id = $1::uuid
        AND tenant_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      LIMIT 1`,
    [reservationId, tenantId],
  );
  const row = rows[0];
  if (!row) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${reservationId} not found`,
    );
  }
  return { targetId: row.id, status: row.status };
};

const logCompletion = (result: BatchCommandResult): BatchCommandResult => {
  logger.info(
    {
      batchId: result.batch_id,
      command: result.command_name,
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      dryRun: result.dry_run,
    },
    "batch command completed",
  );
  return result;
};

/**
 * Cancel many reservations (PMS-01-22).
 *
 * Each cancellation is its own transaction and its own cancellation-fee
 * calculation, exactly as a single cancel would be.
 */
export const massCancelReservations = async (
  tenantId: string,
  command: ReservationMassCancelCommand,
  options: CommandOptions = {},
): Promise<BatchCommandResult> => {
  const context = buildContext(tenantId, "reservation.mass_cancel", command, options);

  const result = await runBatchCommand(
    context,
    command,
    {
      targetIdOf: (item) => item.reservation_id,
      applyItem: async (item) => {
        const outcome = await cancelReservation(
          tenantId,
          {
            reservation_id: item.reservation_id,
            property_id: command.property_id,
            reason: item.reason ?? command.reason,
            cancelled_by: options.actorId,
          },
          options,
        );
        return { targetId: item.reservation_id, eventId: outcome.eventId };
      },
      validateItem: async (item) => {
        const { targetId } = await resolveReservation(tenantId, item.reservation_id);
        return { targetId };
      },
    },
    store,
  );

  return logCompletion(result);
};

/**
 * Check in many reservations (PMS-02-05).
 *
 * Distinct from `group.check_in`, which allocates rooms by proximity across one
 * group booking. This takes an arbitrary set — a coach party spread over four
 * bookings, an arrivals list worked through at once — and checks each in on its
 * own terms, auto-assigning from the room type when no room is named.
 */
export const massCheckInReservations = async (
  tenantId: string,
  command: ReservationMassCheckInCommand,
  options: CommandOptions = {},
): Promise<BatchCommandResult> => {
  const context = buildContext(tenantId, "reservation.mass_check_in", command, options);

  const result = await runBatchCommand(
    context,
    command,
    {
      targetIdOf: (item) => item.reservation_id,
      applyItem: async (item) => {
        const outcome = await checkInReservation(
          tenantId,
          {
            reservation_id: item.reservation_id,
            room_id: item.room_id,
            checked_in_at: command.checked_in_at,
            force: command.force,
            notes: command.notes,
          },
          options,
        );
        return { targetId: item.reservation_id, eventId: outcome.eventId };
      },
      validateItem: async (item) => {
        const { targetId } = await resolveReservation(tenantId, item.reservation_id);
        return { targetId };
      },
    },
    store,
  );

  return logCompletion(result);
};

/**
 * Apply one set of changes to many reservations (PMS-01-21).
 *
 * `changes` is spread onto each target's modify command, so the rate re-quote,
 * the stay-critical availability re-check and the market-segment rules all run
 * per reservation rather than once for the batch. A mass update of check-out
 * dates is 40 individual date changes, each of which can legitimately be
 * refused on inventory while the other 39 succeed.
 */
export const massUpdateReservations = async (
  tenantId: string,
  command: ReservationMassUpdateCommand,
  options: CommandOptions = {},
): Promise<BatchCommandResult> => {
  const context = buildContext(tenantId, "reservation.mass_update", command, options);

  const result = await runBatchCommand(
    context,
    command,
    {
      targetIdOf: (item) => item.reservation_id,
      applyItem: async (item) => {
        const outcome = await modifyReservation(
          tenantId,
          {
            ...command.changes,
            reservation_id: item.reservation_id,
            property_id: command.property_id,
          },
          options,
        );
        return { targetId: item.reservation_id, eventId: outcome.eventId };
      },
      validateItem: async (item) => {
        const { targetId } = await resolveReservation(tenantId, item.reservation_id);
        return { targetId };
      },
    },
    store,
  );

  return logCompletion(result);
};
