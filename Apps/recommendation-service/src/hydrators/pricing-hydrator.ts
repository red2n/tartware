/**
 * PricingHydrator - Enriches candidates with dynamic pricing.
 *
 * Calculates the actual rate for the requested dates, including
 * any applicable discounts or seasonal adjustments.
 */

import { BaseHydrator, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class PricingHydrator extends BaseHydrator<RoomRecommendationQuery, RoomCandidate> {
  readonly name = "pricing";

  async hydrate(
    queryParams: RoomRecommendationQuery,
    candidates: readonly RoomCandidate[],
    context: PipelineContext,
  ): Promise<Partial<RoomCandidate>[]> {
    if (candidates.length === 0) {
      return [];
    }

    const roomTypeIds = [...new Set(candidates.map((c) => c.roomTypeId))];
    context.logger.debug({ roomTypeCount: roomTypeIds.length }, "Fetching dynamic pricing");

    // Get rates for the date range
    const result = await query<{
      room_type_id: string;
      rate: number;
    }>(
      `
      SELECT
        rt.id AS room_type_id,
        COALESCE(rt.base_price, 100) AS rate
      FROM room_types rt
      WHERE rt.id = ANY($1::uuid[])
      `,
      [roomTypeIds],
    );

    const rateMap = new Map(result.rows.map((row) => [row.room_type_id, Number(row.rate)]));

    // Calculate number of nights
    const checkIn = new Date(queryParams.checkInDate);
    const checkOut = new Date(queryParams.checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    return candidates.map((c) => {
      const dynamicRate = rateMap.get(c.roomTypeId) ?? c.baseRate;

      // Apply upgrade discount if applicable
      const finalRate =
        c.isUpgrade && c.upgradeDiscount
          ? dynamicRate * (1 - c.upgradeDiscount / 100)
          : dynamicRate;

      return {
        dynamicRate: finalRate,
        totalPrice: finalRate * nights,
      };
    });
  }
}
