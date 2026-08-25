/**
 * DEV DOC
 * Module: reward-repository.ts
 * Purpose: The reward catalogue and redemption ledger.
 * Ownership: guests-service
 *
 * Lifted verbatim out of `services/reward-service.ts`. The catalogue listing
 * stays in the service: it builds its WHERE clause and parameter list from
 * whichever filters were supplied.
 */

import { query } from "../lib/db.js";

const FIND_REWARD_SQL = `SELECT reward_id, reward_code, points_required, reward_value, min_tier,
            max_redemptions_per_guest, max_total_redemptions, current_redemption_count,
            fulfillment_type
     FROM reward_catalog
     WHERE reward_id = $1::uuid AND tenant_id = $2::uuid AND is_active = true
       AND (available_from IS NULL OR available_from <= CURRENT_DATE)
       AND (available_to IS NULL OR available_to >= CURRENT_DATE)
     LIMIT 1`;

const FIND_LOYALTY_BALANCE_SQL = `SELECT program_id, points_balance, program_tier
     FROM guest_loyalty_programs
     WHERE guest_id = $1::uuid AND tenant_id = $2::uuid
       AND membership_status = 'active'
     ORDER BY points_balance DESC LIMIT 1`;

const COUNT_REDEMPTIONS_FOR_REWARD_SQL = `SELECT COUNT(redemption_id) AS count FROM reward_redemptions
       WHERE reward_id = $1::uuid AND guest_id = $2::uuid AND tenant_id = $3::uuid
         AND redemption_status NOT IN ('cancelled', 'rejected')`;

const COUNT_GUEST_REDEMPTIONS_SQL = `SELECT COUNT(redemption_id) AS count FROM reward_redemptions
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid`;

const SELECT_GUEST_REDEMPTIONS_SQL = `SELECT rr.redemption_id, rr.redemption_code, rr.points_spent,
            rr.reward_value, rr.redemption_status,
            rr.fulfilled_at, rr.cancelled_at, rr.expires_at,
            rr.created_at,
            rc.reward_code, rc.reward_name, rc.reward_category, rc.image_url
     FROM reward_redemptions rr
     INNER JOIN reward_catalog rc ON rc.reward_id = rr.reward_id AND rc.tenant_id = rr.tenant_id
     WHERE rr.tenant_id = $1::uuid AND rr.guest_id = $2::uuid
     ORDER BY rr.created_at DESC
     LIMIT $3 OFFSET $4`;

/**
 * One catalogue reward with its cost and value.
 */
export const findReward = (rewardId: string, tenantId: string) =>
  query<{
    reward_id: string;
    reward_code: string;
    points_required: number;
    reward_value: string;
    min_tier: string | null;
    max_redemptions_per_guest: number | null;
    max_total_redemptions: number | null;
    current_redemption_count: number;
    fulfillment_type: string;
  }>(FIND_REWARD_SQL, [rewardId, tenantId]);

/**
 * A member's point balance and tier.
 */
export const findLoyaltyBalance = (guestId: string, tenantId: string) =>
  query<{
    program_id: string;
    points_balance: number;
    program_tier: string;
  }>(FIND_LOYALTY_BALANCE_SQL, [guestId, tenantId]);

/**
 * How many times this guest has already redeemed this reward, for the
 * per-guest cap.
 */
export const countRedemptionsForReward = (rewardId: string, guestId: string, tenantId: string) =>
  query<{ count: string }>(COUNT_REDEMPTIONS_FOR_REWARD_SQL, [rewardId, guestId, tenantId]);

/**
 * Total redemptions by a guest, for pagination.
 */
export const countGuestRedemptions = (tenantId: string, guestId: string) =>
  query<{ count: string }>(COUNT_GUEST_REDEMPTIONS_SQL, [tenantId, guestId]);

/**
 * A guest's redemption history, newest first.
 */
export const selectGuestRedemptions = (
  tenantId: string,
  guestId: string,
  limit: number,
  offset: number,
) => query(SELECT_GUEST_REDEMPTIONS_SQL, [tenantId, guestId, limit, offset]);
