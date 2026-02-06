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
    context.logger.debug({ guestId: queryParams.guestId }, "Fetching guest preferences");

    const result = await query<{
      preferences: Record<string, unknown> | null;
      loyalty_tier: string | null;
      preferred_room_types: string[] | null;
      view_preferences: string[] | null;
      floor_preference: string | null;
      quiet_room: boolean | null;
      mobility_accessible: boolean | null;
      hearing_accessible: boolean | null;
      visual_accessible: boolean | null;
    }>(
      `
      SELECT
        g.preferences,
        COALESCE(g.loyalty_tier, 'none') AS loyalty_tier,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT gp.preferred_room_type_id::text), NULL) AS preferred_room_types,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT gp.view_preference), NULL) AS view_preferences,
        MAX(gp.floor_preference) AS floor_preference,
        BOOL_OR(gp.room_location_preference = 'QUIET') AS quiet_room,
        BOOL_OR(gp.mobility_accessible) AS mobility_accessible,
        BOOL_OR(gp.hearing_accessible) AS hearing_accessible,
        BOOL_OR(gp.visual_accessible) AS visual_accessible
      FROM guests g
      LEFT JOIN guest_preferences gp
        ON gp.guest_id = g.id
        AND gp.tenant_id = g.tenant_id
        AND gp.is_active = true
        AND gp.is_deleted = false
      WHERE g.id = $1
        AND g.tenant_id = $2
      GROUP BY g.preferences, g.loyalty_tier
      `,
      [queryParams.guestId, queryParams.tenantId],
    );

    const row = result.rows[0];
    const preferences = row?.preferences ?? {};
    const loyaltyTier = row?.loyalty_tier ?? "none";

    const accessibilityNeeds: string[] = [];
    if (row?.mobility_accessible) {
      accessibilityNeeds.push("mobility");
    }
    if (row?.hearing_accessible) {
      accessibilityNeeds.push("hearing");
    }
    if (row?.visual_accessible) {
      accessibilityNeeds.push("visual");
    }

    const rawFloorPreference = row?.floor_preference ?? (preferences as { floor?: string }).floor;
    let floorPreference: GuestPreferences["floorPreference"] | undefined;
    if (typeof rawFloorPreference === "string") {
      const normalized = rawFloorPreference.toLowerCase();
      if (normalized === "high" || normalized === "low" || normalized === "any") {
        floorPreference = normalized;
      } else if (normalized === "middle") {
        floorPreference = "any";
      }
    }

    const preferredRoomTypes = row?.preferred_room_types?.length
      ? row.preferred_room_types
      : (preferences as { roomType?: string }).roomType
        ? [(preferences as { roomType?: string }).roomType as string]
        : undefined;

    const guestPreferences: GuestPreferences = {
      preferredRoomTypes,
      floorPreference,
      viewPreferences: row?.view_preferences ?? undefined,
      accessibilityNeeds: accessibilityNeeds.length > 0 ? accessibilityNeeds : undefined,
      quietRoom: row?.quiet_room ?? undefined,
    };

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
      guestPreferences,
      loyaltyTier,
      budgetRange,
    };
  }
}
