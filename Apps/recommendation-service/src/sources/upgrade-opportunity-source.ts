/**
 * UpgradeOpportunitySource - Fetches premium room upgrade opportunities.
 *
 * Identifies rooms that represent good upgrade opportunities for the guest,
 * potentially at a discounted rate for revenue optimization.
 */

import { BaseSource, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class UpgradeOpportunitySource extends BaseSource<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "upgrade_opportunity";

  /**
   * Enable upgrade suggestions for loyalty members or returning guests.
   */
  enable(queryParams: RoomRecommendationQuery): boolean {
    const isLoyalMember =
      queryParams.loyaltyTier !== undefined &&
      queryParams.loyaltyTier !== "none";
    const isReturningGuest =
      queryParams.guestHistory !== undefined &&
      queryParams.guestHistory.totalBookings > 0;
    return isLoyalMember || isReturningGuest;
  }

  async getCandidates(
    queryParams: RoomRecommendationQuery,
    context: PipelineContext,
  ): Promise<RoomCandidate[]> {
    context.logger.debug(
      {
        guestId: queryParams.guestId,
        loyaltyTier: queryParams.loyaltyTier,
      },
      "Fetching upgrade opportunities",
    );

    // Calculate upgrade discount based on loyalty tier
    const discountPercent = this.getUpgradeDiscount(queryParams.loyaltyTier);
    const avgRate = queryParams.guestHistory?.averageRate ?? 150;

    // Find rooms that are:
    // 1. Higher tier than what guest typically books
    // 2. Available for the dates
    // 3. Can be offered at a discounted rate
    const result = await query<{
      room_id: string;
      room_type_id: string;
      room_type_name: string;
      room_number: string;
      floor: string;
      view_type: string | null;
      base_rate: number;
      status: string;
      max_occupancy: number;
    }>(
      `
      SELECT
        r.id AS room_id,
        r.room_type_id,
        rt.type_name AS room_type_name,
        r.room_number,
        r.floor,
        r.features->>'view' AS view_type,
        COALESCE(rt.base_price, 100) AS base_rate,
        LOWER(r.status::TEXT) AS status,
        rt.max_occupancy
      FROM rooms r
      JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.property_id = $1
        AND r.tenant_id = $2
        AND LOWER(r.status::TEXT) IN ('available', 'clean', 'inspected')
        AND rt.max_occupancy >= $5
        AND r.is_deleted = false
        AND rt.is_deleted = false
        -- Only premium rooms (higher than average rate)
        AND COALESCE(rt.base_price, 100) > $6 * 1.2
        -- But within reasonable upgrade range (< 2x average)
        AND COALESCE(rt.base_price, 100) < $6 * 2.0
        AND NOT EXISTS (
          SELECT 1 FROM reservations res
          WHERE res.property_id = r.property_id
            AND res.room_number = r.room_number
            AND LOWER(res.status::TEXT) NOT IN ('cancelled', 'no_show', 'checked_out')
            AND res.check_in_date < $4
            AND res.check_out_date > $3
        )
      ORDER BY COALESCE(rt.base_price, 100) ASC
      LIMIT 20
      `,
      [
        queryParams.propertyId,
        queryParams.tenantId,
        queryParams.checkInDate,
        queryParams.checkOutDate,
        queryParams.adults + queryParams.children,
        avgRate,
      ],
    );

    const candidates: RoomCandidate[] = result.rows.map((row) => ({
      roomId: row.room_id,
      roomTypeId: row.room_type_id,
      roomTypeName: row.room_type_name,
      roomNumber: row.room_number,
      floor: row.floor,
      viewType: row.view_type ?? undefined,
      baseRate: Number(row.base_rate),
      status: row.status,
      maxOccupancy: row.max_occupancy,
      source: this.name,
      isUpgrade: true,
      upgradeDiscount: discountPercent,
    }));

    context.logger.debug(
      { count: candidates.length, discountPercent },
      "Upgrade opportunities fetched",
    );
    return candidates;
  }

  private getUpgradeDiscount(loyaltyTier?: string): number {
    switch (loyaltyTier) {
      case "platinum":
        return 25;
      case "gold":
        return 20;
      case "silver":
        return 15;
      default:
        return 10;
    }
  }
}
