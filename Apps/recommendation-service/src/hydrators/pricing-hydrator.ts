/**
 * PricingHydrator - Enriches candidates with dynamic pricing.
 *
 * Calculates the actual rate for the requested dates, including
 * any applicable discounts or seasonal adjustments.
 */

import { BaseHydrator, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class PricingHydrator extends BaseHydrator<
  RoomRecommendationQuery,
  RoomCandidate
> {
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
    context.logger.debug(
      { roomTypeCount: roomTypeIds.length },
      "Fetching dynamic pricing",
    );

    // Get rates for the date range
    const result = await query<{
      room_type_id: string;
      rate: number;
    }>(
      `
      SELECT
        room_type_id,
        COALESCE(
          (SELECT rr.base_rate
           FROM room_rates rr
           WHERE rr.room_type_id = rt.room_type_id
             AND rr.effective_date <= $2
             AND (rr.end_date IS NULL OR rr.end_date >= $3)
           ORDER BY rr.effective_date DESC
           LIMIT 1),
          rt.base_rate,
          100
        ) AS rate
      FROM room_types rt
      WHERE rt.room_type_id = ANY($1::uuid[])
      `,
      [roomTypeIds, queryParams.checkInDate, queryParams.checkOutDate],
    );

    const rateMap = new Map(
      result.rows.map((row) => [row.room_type_id, Number(row.rate)]),
    );

    // Calculate number of nights
    const checkIn = new Date(queryParams.checkInDate);
    const checkOut = new Date(queryParams.checkOutDate);
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );

    return candidates.map((c) => {
      const dynamicRate = rateMap.get(c.roomTypeId) ?? c.baseRate;

      // Apply upgrade discount if applicable
      const finalRate = c.isUpgrade && c.upgradeDiscount
        ? dynamicRate * (1 - c.upgradeDiscount / 100)
        : dynamicRate;

      return {
        dynamicRate: finalRate,
        totalPrice: finalRate * nights,
      };
    });
  }
}
