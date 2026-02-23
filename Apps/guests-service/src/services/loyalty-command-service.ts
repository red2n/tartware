/**
 * Loyalty Command Service
 * Handles loyalty.points.earn and loyalty.points.redeem commands
 * Maintains the loyalty_point_transactions ledger and updates program balance
 */

import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
  LoyaltyPointsEarnCommandSchema,
  LoyaltyPointsExpireSweepCommandSchema,
  LoyaltyPointsRedeemCommandSchema,
} from "../schemas/loyalty-commands.js";

const loyaltyLogger = appLogger.child({ module: "loyalty-command-service" });

const APP_ACTOR = "COMMAND_CENTER";

const resolveActorId = (initiatedBy?: { userId?: string } | null): string =>
  initiatedBy?.userId ?? APP_ACTOR;

type CommandContext = {
  tenantId: string;
  payload: unknown;
  correlationId?: string;
  initiatedBy?: { userId?: string } | null;
};

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
  const { rows, rowCount } = await query<{
    transaction_id: string;
    balance_after: number;
  }>(
    `
      WITH updated AS (
        UPDATE guest_loyalty_programs
        SET
          points_balance = COALESCE(points_balance, 0) + $3,
          points_earned_lifetime = COALESCE(points_earned_lifetime, 0) + $3,
          last_points_earned_date = CURRENT_DATE,
          last_activity_date = CURRENT_DATE,
          updated_at = NOW(),
          updated_by = $7
        WHERE tenant_id = $1::uuid
          AND program_id = $2::uuid
          AND COALESCE(is_deleted, false) = false
        RETURNING points_balance
      )
      INSERT INTO loyalty_point_transactions (
        tenant_id, program_id, guest_id,
        transaction_type, points, balance_after,
        reference_type, reference_id, description,
        expires_at, performed_by
      )
      SELECT
        $1::uuid, $2::uuid, glp.guest_id,
        'earn', $3, u.points_balance,
        $4, $5::uuid, $6,
        $8::timestamptz, $7
      FROM updated u
      JOIN guest_loyalty_programs glp ON glp.program_id = $2::uuid
      RETURNING transaction_id, balance_after
    `,
    [
      tenantId,
      command.program_id,
      command.points,
      command.reference_type ?? null,
      command.reference_id ?? null,
      command.description ?? null,
      actor,
      command.expires_at?.toISOString() ?? null,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("LOYALTY_PROGRAM_NOT_FOUND");
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
  const { rows, rowCount } = await query<{
    transaction_id: string;
    balance_after: number;
  }>(
    `
      WITH updated AS (
        UPDATE guest_loyalty_programs
        SET
          points_balance = COALESCE(points_balance, 0) - $3,
          points_redeemed_lifetime = COALESCE(points_redeemed_lifetime, 0) + $3,
          last_points_redeemed_date = CURRENT_DATE,
          last_activity_date = CURRENT_DATE,
          updated_at = NOW(),
          updated_by = $7
        WHERE tenant_id = $1::uuid
          AND program_id = $2::uuid
          AND COALESCE(points_balance, 0) >= $3
          AND COALESCE(is_deleted, false) = false
        RETURNING points_balance
      )
      INSERT INTO loyalty_point_transactions (
        tenant_id, program_id, guest_id,
        transaction_type, points, balance_after,
        reference_type, reference_id, description,
        performed_by
      )
      SELECT
        $1::uuid, $2::uuid, glp.guest_id,
        'redeem', -$3, u.points_balance,
        $4, $5::uuid, $6,
        $7
      FROM updated u
      JOIN guest_loyalty_programs glp ON glp.program_id = $2::uuid
      RETURNING transaction_id, balance_after
    `,
    [
      tenantId,
      command.program_id,
      command.points,
      command.reference_type ?? null,
      command.reference_id ?? null,
      command.description ?? null,
      actor,
    ],
  );

  if (!rowCount || rowCount === 0) {
    throw new Error("INSUFFICIENT_POINTS_OR_PROGRAM_NOT_FOUND");
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
  const { rowCount } = await query<{ program_id: string; expired_points: number }>(
    `
      WITH expired AS (
        SELECT transaction_id, tenant_id, program_id, guest_id, points
        FROM loyalty_point_transactions
        WHERE tenant_id = $1::uuid
          AND expired = FALSE
          AND expires_at IS NOT NULL
          AND expires_at <= NOW()
          AND transaction_type IN ('earn', 'bonus', 'adjust', 'transfer_in')
          AND points > 0
        ORDER BY expires_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      ),
      mark_expired AS (
        UPDATE loyalty_point_transactions lpt
        SET expired = TRUE
        FROM expired e
        WHERE lpt.transaction_id = e.transaction_id
      ),
      balance_updates AS (
        UPDATE guest_loyalty_programs glp
        SET
          points_balance = GREATEST(COALESCE(glp.points_balance, 0) - agg.total_points, 0),
          updated_at = NOW()
        FROM (
          SELECT program_id, SUM(points) AS total_points
          FROM expired
          GROUP BY program_id
        ) agg
        WHERE glp.program_id = agg.program_id
          AND glp.tenant_id = $1::uuid
        RETURNING glp.program_id, glp.points_balance, agg.total_points
      )
      INSERT INTO loyalty_point_transactions (
        tenant_id, program_id, guest_id,
        transaction_type, points, balance_after,
        reference_type, description, performed_by
      )
      SELECT
        e.tenant_id, e.program_id, e.guest_id,
        'expire', -e.points,
        COALESCE(bu.points_balance, 0),
        'sweep', 'Automatic points expiration',
        'SYSTEM'
      FROM expired e
      LEFT JOIN balance_updates bu ON bu.program_id = e.program_id
    `,
    [tenantId, batchSize],
  );

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
