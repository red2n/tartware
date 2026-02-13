/**
 * Loyalty Command Service
 * Handles loyalty.points.earn and loyalty.points.redeem commands
 * Maintains the loyalty_point_transactions ledger and updates program balance
 */

import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
	LoyaltyPointsEarnCommandSchema,
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
