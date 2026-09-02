/**
 * Loyalty Command Service
 * Handles loyalty.points.earn and loyalty.points.redeem commands
 * Maintains the loyalty_point_transactions ledger and updates program balance
 */

import { CommandError, resolveActorId } from "@tartware/command-consumer-utils/command-utils";
import type { CommandContext } from "@tartware/schemas";
import { appLogger } from "../lib/logger.js";
import {
  accruePoints,
  enrolMember,
  expirePointsBatch,
  redeemPoints,
} from "../repositories/loyalty-repository.js";
import {
  LoyaltyPointsEarnCommandSchema,
  LoyaltyPointsExpireSweepCommandSchema,
  LoyaltyPointsRedeemCommandSchema,
  LoyaltyProgramEnrollCommandSchema,
} from "../schemas/loyalty-commands.js";

const loyaltyLogger = appLogger.child({ module: "loyalty-command-service" });

/**
 * Earn points: inserts a ledger row, increments program balance, returns new balance.
 */
export const earnLoyaltyPoints = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: CommandContext): Promise<void> => {
  const command = LoyaltyPointsEarnCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);

  // Atomically update balance and insert ledger row
  const { rows, rowCount } = await accruePoints(tenantId, command, actor);

  if (!rowCount || rowCount === 0) {
    throw new CommandError("LOYALTY_PROGRAM_NOT_FOUND", "Loyalty program not found");
  }

  loyaltyLogger.info(
    {
      tenantId,
      programId: command.program_id,
      guestId: command.guest_id,
      points: command.points,
      balanceAfter: rows[0]?.balance_after,
      transactionId: rows[0]?.transaction_id,
      correlationId,
      initiatedBy,
    },
    "loyalty.points.earn command applied",
  );
};

/**
 * Redeem points: inserts a negative ledger row, decrements program balance.
 * Fails if insufficient balance.
 */
export const redeemLoyaltyPoints = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: CommandContext): Promise<void> => {
  const command = LoyaltyPointsRedeemCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);

  // Check and deduct atomically
  const { rows, rowCount } = await redeemPoints(tenantId, command, actor);

  if (!rowCount || rowCount === 0) {
    throw new CommandError(
      "INSUFFICIENT_POINTS_OR_PROGRAM_NOT_FOUND",
      "Loyalty program not found, or the member has too few points",
    );
  }

  loyaltyLogger.info(
    {
      tenantId,
      programId: command.program_id,
      guestId: command.guest_id,
      pointsRedeemed: command.points,
      balanceAfter: rows[0]?.balance_after,
      transactionId: rows[0]?.transaction_id,
      correlationId,
      initiatedBy,
    },
    "loyalty.points.redeem command applied",
  );
};

/**
 * Expire sweep: finds un-expired ledger rows where expires_at <= NOW(),
 * inserts offsetting 'expire' rows, and decrements program balances.
 * Processes in batches scoped to the tenant.
 */
export const expireLoyaltyPoints = async ({
  tenantId,
  payload,
  correlationId,
}: CommandContext): Promise<void> => {
  const command = LoyaltyPointsExpireSweepCommandSchema.parse(payload);
  const batchSize = command.batch_size ?? 500;

  // Atomically: mark expired, insert ledger rows, decrement balances
  const { rowCount } = await expirePointsBatch(tenantId, batchSize);

  loyaltyLogger.info(
    {
      tenantId,
      expiredCount: rowCount ?? 0,
      batchSize,
      correlationId,
    },
    "loyalty.points.expire_sweep completed",
  );
};

/**
 * Enrol a guest into a loyalty program.
 *
 * Creates the guest_loyalty_programs row that earn/redeem/expire operate on —
 * without it those commands fail with LOYALTY_PROGRAM_NOT_FOUND. Re-enrolling
 * the same guest into the same program is a no-op so the command is safe to
 * replay.
 */
export const enrollLoyaltyProgram = async ({
  tenantId,
  payload,
  correlationId,
  initiatedBy,
}: CommandContext): Promise<void> => {
  const command = LoyaltyProgramEnrollCommandSchema.parse(payload);
  const actor = resolveActorId(initiatedBy);

  const { rows } = await enrolMember(tenantId, command, actor);

  loyaltyLogger.info(
    {
      tenantId,
      guestId: command.guest_id,
      programId: rows[0]?.program_id ?? null,
      alreadyEnrolled: rows.length === 0,
      correlationId,
    },
    "loyalty.program.enroll completed",
  );
};
