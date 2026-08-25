/**
 * DEV DOC
 * Module: loyalty-read-repository.ts
 * Purpose: Loyalty reads and tier-rule writes behind the loyalty REST routes.
 * Ownership: guests-service
 *
 * Lifted verbatim out of `routes/loyalty.ts`, so the route handlers validate,
 * authorise and shape responses without holding SQL.
 */

import { query } from "../lib/db.js";

const LIST_POINT_TRANSACTIONS_SQL = `
          SELECT
            transaction_id, tenant_id, program_id, guest_id,
            transaction_type, points, balance_after,
            currency_value, reference_type, reference_id,
            description, expires_at, expired,
            performed_by, created_at
          FROM loyalty_point_transactions
          WHERE tenant_id = $1::uuid
            AND program_id = $2::uuid
            AND ($3::text IS NULL OR transaction_type = $3::text)
          ORDER BY created_at DESC
          LIMIT $4 OFFSET $5
        `;

const LIST_TIER_RULES_SQL = `
          SELECT
            rule_id, tenant_id, property_id,
            tier_name, tier_rank, display_name,
            min_nights, min_stays, min_points, min_spend,
            qualification_period_months,
            points_per_dollar, bonus_multiplier, points_expiry_months,
            benefits, welcome_bonus_points,
            is_active,
            created_at, updated_at, created_by, updated_by
          FROM loyalty_tier_rules
          WHERE tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR property_id = $2::uuid OR property_id IS NULL)
            AND ($3::boolean IS NULL OR is_active = $3::boolean)
          ORDER BY tier_rank ASC
        `;

/**
 * Two partial unique indexes cover loyalty_tier_rules — one for
 * property-scoped rules and one for tenant-wide rules — so the caller decides
 * which conflict target applies.
 */
const buildInsertTierRuleSql = (conflictTarget: string) => `
          INSERT INTO loyalty_tier_rules (
            tenant_id, property_id, tier_name, tier_rank, display_name,
            min_nights, min_stays, min_points, min_spend,
            qualification_period_months, points_per_dollar, bonus_multiplier,
            points_expiry_months, benefits, welcome_bonus_points, is_active
          ) VALUES (
            $1::uuid, $2::uuid, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14::jsonb, $15, $16
          )
          ON CONFLICT ${conflictTarget} DO UPDATE SET
            tier_rank                   = EXCLUDED.tier_rank,
            display_name                = EXCLUDED.display_name,
            min_nights                  = EXCLUDED.min_nights,
            min_stays                   = EXCLUDED.min_stays,
            min_points                  = EXCLUDED.min_points,
            min_spend                   = EXCLUDED.min_spend,
            qualification_period_months = EXCLUDED.qualification_period_months,
            points_per_dollar           = EXCLUDED.points_per_dollar,
            bonus_multiplier            = EXCLUDED.bonus_multiplier,
            points_expiry_months        = EXCLUDED.points_expiry_months,
            benefits                    = EXCLUDED.benefits,
            welcome_bonus_points        = EXCLUDED.welcome_bonus_points,
            is_active                   = EXCLUDED.is_active,
            updated_at                  = NOW()
          RETURNING
            rule_id, tenant_id, property_id,
            tier_name, tier_rank, display_name,
            min_nights, min_stays, min_points, min_spend,
            qualification_period_months,
            points_per_dollar, bonus_multiplier, points_expiry_months,
            benefits, welcome_bonus_points,
            is_active,
            created_at, updated_at, created_by, updated_by
        `;

const FIND_LOYALTY_PROGRAM_SQL = `
          SELECT
            program_id, guest_id, tier_name,
            COALESCE(points_balance, 0) AS points_balance,
            COALESCE(points_earned_lifetime, 0) AS points_earned_lifetime,
            COALESCE(points_redeemed_lifetime, 0) AS points_redeemed_lifetime,
            last_activity_date
          FROM guest_loyalty_programs
          WHERE tenant_id = $1::uuid
            AND program_id = $2::uuid
            AND COALESCE(is_deleted, false) = false
        `;

/**
 * A member's point-transaction ledger, newest first.
 */
export const listPointTransactions = (
  tenantId: string,
  programId: string,
  transactionType: string | null,
  limit: number,
  offset: number,
) => query(LIST_POINT_TRANSACTIONS_SQL, [tenantId, programId, transactionType, limit, offset]);

/**
 * Loyalty tier rules, optionally scoped to a property.
 */
export const listTierRules = (
  tenantId: string,
  propertyId: string | null,
  isActive: boolean | null,
) => query(LIST_TIER_RULES_SQL, [tenantId, propertyId, isActive]);

/**
 * Create a loyalty tier rule.
 */
export const insertTierRule = (
  body: Record<string, unknown> & { tenant_id: string },
  conflictTarget: string,
) =>
  query(buildInsertTierRuleSql(conflictTarget), [
    body.tenant_id,
    body.property_id ?? null,
    body.tier_name,
    body.tier_rank,
    body.display_name ?? null,
    body.min_nights,
    body.min_stays,
    body.min_points,
    body.min_spend,
    body.qualification_period_months,
    body.points_per_dollar,
    body.bonus_multiplier,
    body.points_expiry_months ?? null,
    JSON.stringify(body.benefits),
    body.welcome_bonus_points,
    body.is_active,
  ]);

/**
 * One membership with its balance and tier.
 */
export const findLoyaltyProgram = (tenantId: string, programId: string) =>
  query(FIND_LOYALTY_PROGRAM_SQL, [tenantId, programId]);
