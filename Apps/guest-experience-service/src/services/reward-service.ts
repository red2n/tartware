import { randomUUID } from "node:crypto";
import { query, queryWithClient, withTransaction } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "reward-service" });

/**
 * List available rewards from the catalog, filtered by tenant/property and
 * optionally by the guest's loyalty tier.
 */
export async function listRewardCatalog(params: {
  tenantId: string;
  propertyId?: string;
  guestTier?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rewards: unknown[]; total: number }> {
  const limit = Math.min(params.limit ?? 50, 100);
  const offset = params.offset ?? 0;

  const conditions: string[] = ["rc.tenant_id = $1::uuid", "rc.is_active = true"];
  const values: unknown[] = [params.tenantId];
  let idx = 2;

  if (params.propertyId) {
    conditions.push(`(rc.property_id = $${idx}::uuid OR rc.property_id IS NULL)`);
    values.push(params.propertyId);
    idx++;
  }

  if (params.category) {
    conditions.push(`rc.reward_category = $${idx}`);
    values.push(params.category);
    idx++;
  }

  // Filter by tier: show rewards where min_tier <= guest tier or min_tier is null
  if (params.guestTier) {
    const tierRanks: Record<string, number> = {
      bronze: 1,
      silver: 2,
      gold: 3,
      platinum: 4,
      diamond: 5,
      elite: 6,
    };
    const guestRank = tierRanks[params.guestTier.toLowerCase()] ?? 0;
    if (guestRank > 0) {
      conditions.push(
        `(rc.min_tier IS NULL OR rc.min_tier IN (${Object.entries(tierRanks)
          .filter(([, rank]) => rank <= guestRank)
          .map(([tier]) => `'${tier}'`)
          .join(", ")}))`,
      );
    }
  }

  const where = conditions.join(" AND ");

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM reward_catalog rc WHERE ${where}`,
    values,
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  const result = await query(
    `SELECT rc.reward_id, rc.reward_code, rc.reward_name, rc.reward_description,
            rc.reward_category, rc.points_required, rc.reward_value, rc.currency,
            rc.min_tier, rc.fulfillment_type, rc.image_url, rc.featured,
            rc.available_from, rc.available_to, rc.max_redemptions_per_guest
     FROM reward_catalog rc
     WHERE ${where}
     ORDER BY rc.featured DESC, rc.sort_order, rc.reward_name
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  return { rewards: result.rows, total };
}

/**
 * Redeem a reward for a guest. Validates points balance, tier eligibility,
 * and redemption limits before deducting points and creating the redemption record.
 */
export async function redeemReward(params: {
  tenantId: string;
  propertyId: string;
  guestId: string;
  rewardId: string;
  reservationId?: string;
  actorId?: string;
}): Promise<{ redemptionId: string; redemptionCode: string; pointsSpent: number }> {
  // Load reward
  const rewardResult = await query<{
    reward_id: string;
    reward_code: string;
    points_required: number;
    reward_value: string;
    min_tier: string | null;
    max_redemptions_per_guest: number | null;
    max_total_redemptions: number | null;
    current_redemption_count: number;
    fulfillment_type: string;
  }>(
    `SELECT reward_id, reward_code, points_required, reward_value, min_tier,
            max_redemptions_per_guest, max_total_redemptions, current_redemption_count,
            fulfillment_type
     FROM reward_catalog
     WHERE reward_id = $1::uuid AND tenant_id = $2::uuid AND is_active = true
       AND (available_from IS NULL OR available_from <= CURRENT_DATE)
       AND (available_to IS NULL OR available_to >= CURRENT_DATE)
     LIMIT 1`,
    [params.rewardId, params.tenantId],
  );

  const reward = rewardResult.rows[0];
  if (!reward) {
    throw new RewardServiceError("REWARD_NOT_FOUND", "Reward not found or not currently available");
  }

  // Check total redemption cap
  if (
    reward.max_total_redemptions &&
    reward.current_redemption_count >= reward.max_total_redemptions
  ) {
    throw new RewardServiceError("REWARD_SOLD_OUT", "This reward has reached its redemption limit");
  }

  // Load guest loyalty program
  const programResult = await query<{
    program_id: string;
    points_balance: number;
    program_tier: string;
  }>(
    `SELECT program_id, points_balance, program_tier
     FROM guest_loyalty_programs
     WHERE guest_id = $1::uuid AND tenant_id = $2::uuid
       AND membership_status = 'active'
     ORDER BY points_balance DESC LIMIT 1`,
    [params.guestId, params.tenantId],
  );

  const program = programResult.rows[0];
  if (!program) {
    throw new RewardServiceError(
      "NO_LOYALTY_PROGRAM",
      "Guest does not have an active loyalty program",
    );
  }

  // Check tier eligibility
  if (reward.min_tier) {
    const tierRanks: Record<string, number> = {
      bronze: 1,
      silver: 2,
      gold: 3,
      platinum: 4,
      diamond: 5,
      elite: 6,
    };
    const guestRank = tierRanks[program.program_tier?.toLowerCase()] ?? 0;
    const requiredRank = tierRanks[reward.min_tier] ?? 0;
    if (guestRank < requiredRank) {
      throw new RewardServiceError(
        "TIER_INSUFFICIENT",
        `Reward requires ${reward.min_tier} tier, guest is ${program.program_tier}`,
      );
    }
  }

  // Check per-guest redemption limit
  if (reward.max_redemptions_per_guest) {
    const guestCountResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM reward_redemptions
       WHERE reward_id = $1::uuid AND guest_id = $2::uuid AND tenant_id = $3::uuid
         AND redemption_status NOT IN ('cancelled', 'rejected')`,
      [params.rewardId, params.guestId, params.tenantId],
    );
    if (Number(guestCountResult.rows[0]?.count ?? 0) >= reward.max_redemptions_per_guest) {
      throw new RewardServiceError(
        "GUEST_LIMIT_REACHED",
        "You have reached the maximum number of redemptions for this reward",
      );
    }
  }

  // Check points balance
  const pointsRequired = reward.points_required;
  if (program.points_balance < pointsRequired) {
    throw new RewardServiceError(
      "INSUFFICIENT_POINTS",
      `Requires ${pointsRequired} points, but you have ${program.points_balance}`,
    );
  }

  const redemptionId = randomUUID();
  const redemptionCode = `RD-${reward.reward_code}-${Date.now().toString(36).toUpperCase()}`;
  const actorId = params.actorId ?? params.guestId;
  const initialStatus = reward.fulfillment_type === "automatic" ? "fulfilled" : "pending";

  await withTransaction(async (client) => {
    // Deduct points from loyalty program
    await queryWithClient(
      client,
      `UPDATE guest_loyalty_programs
       SET points_balance = points_balance - $3,
           points_redeemed_lifetime = points_redeemed_lifetime + $3,
           updated_at = NOW()
       WHERE program_id = $1::uuid AND tenant_id = $2::uuid
         AND points_balance >= $3`,
      [program.program_id, params.tenantId, pointsRequired],
    );

    // Record loyalty point transaction
    await queryWithClient(
      client,
      `INSERT INTO loyalty_point_transactions (
         tenant_id, program_id, guest_id,
         transaction_type, points, balance_after,
         reference_type, reference_id, description,
         created_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid,
         'redeem', $4, (SELECT points_balance FROM guest_loyalty_programs WHERE program_id = $2::uuid),
         'reward_redemption', $5::uuid, $6,
         $7::uuid
       )`,
      [
        params.tenantId,
        program.program_id,
        params.guestId,
        -pointsRequired,
        redemptionId,
        `Redeemed: ${reward.reward_code}`,
        actorId,
      ],
    );

    // Create redemption record
    await queryWithClient(
      client,
      `INSERT INTO reward_redemptions (
         redemption_id, tenant_id, property_id,
         reward_id, program_id, guest_id, reservation_id,
         redemption_code, points_spent, reward_value, currency,
         redemption_status,
         ${initialStatus === "fulfilled" ? "fulfilled_at, fulfilled_by," : ""}
         created_by, updated_by
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid,
         $4::uuid, $5::uuid, $6::uuid, $7,
         $8, $9, $10, 'USD',
         $11,
         ${initialStatus === "fulfilled" ? "NOW(), $12::uuid," : ""}
         $12::uuid, $12::uuid
       )`,
      [
        redemptionId,
        params.tenantId,
        params.propertyId,
        params.rewardId,
        program.program_id,
        params.guestId,
        params.reservationId ?? null,
        redemptionCode,
        pointsRequired,
        Number(reward.reward_value ?? 0),
        initialStatus,
        actorId,
      ],
    );

    // Increment reward catalog counter
    await queryWithClient(
      client,
      `UPDATE reward_catalog
       SET current_redemption_count = current_redemption_count + 1,
           updated_at = NOW()
       WHERE reward_id = $1::uuid AND tenant_id = $2::uuid`,
      [params.rewardId, params.tenantId],
    );
  });

  logger.info(
    {
      redemptionId,
      rewardCode: reward.reward_code,
      guestId: params.guestId,
      pointsSpent: pointsRequired,
    },
    "Reward redeemed",
  );

  return { redemptionId, redemptionCode, pointsSpent: pointsRequired };
}

/**
 * List a guest's past reward redemptions.
 */
export async function listGuestRedemptions(params: {
  tenantId: string;
  guestId: string;
  limit?: number;
  offset?: number;
}): Promise<{ redemptions: unknown[]; total: number }> {
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = params.offset ?? 0;

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM reward_redemptions
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid`,
    [params.tenantId, params.guestId],
  );

  const result = await query(
    `SELECT rr.redemption_id, rr.redemption_code, rr.points_spent,
            rr.reward_value, rr.redemption_status,
            rr.fulfilled_at, rr.cancelled_at, rr.expires_at,
            rr.created_at,
            rc.reward_code, rc.reward_name, rc.reward_category, rc.image_url
     FROM reward_redemptions rr
     INNER JOIN reward_catalog rc ON rc.reward_id = rr.reward_id AND rc.tenant_id = rr.tenant_id
     WHERE rr.tenant_id = $1::uuid AND rr.guest_id = $2::uuid
     ORDER BY rr.created_at DESC
     LIMIT $3 OFFSET $4`,
    [params.tenantId, params.guestId, limit, offset],
  );

  return {
    redemptions: result.rows,
    total: Number(countResult.rows[0]?.count ?? 0),
  };
}

export class RewardServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RewardServiceError";
  }
}
