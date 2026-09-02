/**
 * DEV DOC
 * Module: loyalty-repository.ts
 * Purpose: Loyalty balances and the point-transaction ledger. Accrual and
 *          redemption each move the balance and write the ledger row in one
 *          statement, so the two cannot drift apart.
 * Ownership: guests-service
 *
 * Lifted verbatim out of `services/loyalty-command-service.ts`.
 */

import type {
  LoyaltyPointsEarnCommand,
  LoyaltyPointsRedeemCommand,
  LoyaltyProgramEnrollCommand,
} from "@tartware/schemas";

import { query } from "../lib/db.js";

const ACCRUE_POINTS_SQL = `
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
    `;

const REDEEM_POINTS_SQL = `
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
    `;

const EXPIRE_POINTS_BATCH_SQL = `
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
    `;

const ENROL_MEMBER_SQL = `
      INSERT INTO guest_loyalty_programs (
        program_id, tenant_id, property_id, guest_id,
        program_name, program_tier, membership_number,
        membership_status, points_balance,
        enrollment_date, enrollment_channel, enrollment_property_id,
        is_active, last_activity_date, created_by, updated_by
      ) VALUES (
        COALESCE($10::uuid, uuid_generate_v4()), $1::uuid, $2::uuid, $3::uuid,
        $4, $5, COALESCE($6, 'MB-' || SUBSTRING(REPLACE($3::text, '-', '') FROM 1 FOR 10)),
        'active', COALESCE($7, 0),
        CURRENT_DATE, $8, $2::uuid,
        true, CURRENT_DATE, $9, $9
      )
      ON CONFLICT (program_id) DO NOTHING
      RETURNING program_id
    `;

/**
 * Credit points and write the matching ledger transaction in one statement.
 */
export const accruePoints = (tenantId: string, command: LoyaltyPointsEarnCommand, actor: string) =>
  query<{
    transaction_id: string;
    balance_after: number;
  }>(ACCRUE_POINTS_SQL, [
    tenantId,
    command.program_id,
    command.points,
    command.reference_type ?? null,
    command.reference_id ?? null,
    command.description ?? null,
    actor,
    command.expires_at?.toISOString() ?? null,
  ]);

/**
 * Debit points and write the matching ledger transaction in one statement.
 */
export const redeemPoints = (
  tenantId: string,
  command: LoyaltyPointsRedeemCommand,
  actor: string,
) =>
  query<{
    transaction_id: string;
    balance_after: number;
  }>(REDEEM_POINTS_SQL, [
    tenantId,
    command.program_id,
    command.points,
    command.reference_type ?? null,
    command.reference_id ?? null,
    command.description ?? null,
    actor,
  ]);

/**
 * Expire a batch of aged point transactions and adjust the balances they came from.
 */
export const expirePointsBatch = (tenantId: string, batchSize: number) =>
  query<{ program_id: string; expired_points: number }>(EXPIRE_POINTS_BATCH_SQL, [
    tenantId,
    batchSize,
  ]);

/**
 * Enrol a guest into a loyalty programme.
 */
export const enrolMember = (
  tenantId: string,
  command: LoyaltyProgramEnrollCommand,
  actor: string,
) =>
  query<{ program_id: string }>(ENROL_MEMBER_SQL, [
    tenantId,
    command.property_id ?? null,
    command.guest_id,
    command.program_name,
    command.program_tier ?? null,
    command.membership_number ?? null,
    command.points_balance ?? null,
    command.enrollment_channel ?? "property",
    actor,
    command.program_id ?? null,
  ]);
