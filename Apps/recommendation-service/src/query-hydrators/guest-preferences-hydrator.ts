/**
 * GuestPreferencesHydrator - Enriches query with guest's stored preferences.
 */

import { BaseQueryHydrator, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { GuestPreferences, RoomRecommendationQuery } from "../types.js";

export class GuestPreferencesHydrator extends BaseQueryHydrator<RoomRecommendationQuery> {
  readonly name = "guest_preferences";

  /**
   * Only enable if we have a guest ID.
   */
  enable(queryParams: RoomRecommendationQuery): boolean {
    return queryParams.guestId !== undefined;
  }

  async hydrate(
    queryParams: RoomRecommendationQuery,
    context: PipelineContext,
  ): Promise<Partial<RoomRecommendationQuery>> {
    context.logger.debug(
      { guestId: queryParams.guestId },
      "Fetching guest preferences",
    );

    const result = await query<{
      preferences: GuestPreferences | null;
      loyalty_tier: string | null;
    }>(
      `
      SELECT
        g.preferences,
        COALESCE(lm.tier, 'none') AS loyalty_tier
      FROM guests g
      LEFT JOIN loyalty_members lm ON g.guest_id = lm.guest_id
      WHERE g.guest_id = $1
        AND g.tenant_id = $2
      `,
      [queryParams.guestId, queryParams.tenantId],
    );

    const row = result.rows[0];
    const preferences = row?.preferences ?? {};
    const loyaltyTier = row?.loyalty_tier ?? "none";

    context.logger.debug(
      { loyaltyTier, hasPreferences: !!row?.preferences },
      "Guest preferences fetched",
    );

    // Calculate budget range from history if available
    let budgetRange: { min: number; max: number } | undefined;
    if (queryParams.guestHistory) {
      const avgRate = queryParams.guestHistory.averageRate;
      budgetRange = {
        min: avgRate * 0.7,
        max: avgRate * 1.5,
      };
    }

    return {
      guestPreferences: preferences as GuestPreferences,
      loyaltyTier,
      budgetRange,
    };
  }
}
