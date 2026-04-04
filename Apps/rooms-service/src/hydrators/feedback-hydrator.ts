/**
 * FeedbackHydrator - Enriches candidates with aggregate guest feedback statistics.
 *
 * Queries the guest_feedback table to compute per-room-type aggregate ratings,
 * sentiment, and would-return rates. Also queries recommendation_interactions
 * for conversion rates (booked/shown ratio).
 *
 * This is the foundation of the feedback loop that transforms the recommendation
 * engine from rule-based ranking to data-driven personalization.
 */

import { BaseHydrator, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomFeedbackStats, RoomRecommendationQuery } from "../types.js";

export class FeedbackHydrator extends BaseHydrator<RoomRecommendationQuery, RoomCandidate> {
  readonly name = "feedback";

  async hydrate(
    queryParams: RoomRecommendationQuery,
    candidates: readonly RoomCandidate[],
    context: PipelineContext,
  ): Promise<Partial<RoomCandidate>[]> {
    if (candidates.length === 0) {
      return [];
    }

    const roomTypeIds = [...new Set(candidates.map((c) => c.roomTypeId))];
    context.logger.debug({ roomTypeCount: roomTypeIds.length }, "Fetching feedback stats");

    // Fetch aggregate feedback stats per room type from the last 12 months
    const feedbackResult = await query<{
      room_type_id: string;
      avg_rating: string | null;
      review_count: string;
      would_return_rate: string | null;
      avg_sentiment: string | null;
      avg_cleanliness: string | null;
      avg_comfort: string | null;
      avg_value: string | null;
      avg_amenities: string | null;
    }>(
      `
      SELECT
        r.room_type_id,
        AVG(gf.overall_rating)::DECIMAL(3,2) AS avg_rating,
        COUNT(*)::TEXT AS review_count,
        AVG(CASE WHEN gf.would_return THEN 1.0 ELSE 0.0 END)::DECIMAL(3,2) AS would_return_rate,
        AVG(gf.sentiment_score)::DECIMAL(5,2) AS avg_sentiment,
        AVG(gf.cleanliness_rating)::DECIMAL(3,2) AS avg_cleanliness,
        AVG(gf.comfort_rating)::DECIMAL(3,2) AS avg_comfort,
        AVG(gf.value_rating)::DECIMAL(3,2) AS avg_value,
        AVG(gf.amenities_rating)::DECIMAL(3,2) AS avg_amenities
      FROM guest_feedback gf
      JOIN reservations res ON gf.reservation_id = res.id
      JOIN rooms r ON res.room_number = r.room_number
        AND res.tenant_id = r.tenant_id
      WHERE r.room_type_id = ANY($1::uuid[])
        AND gf.tenant_id = $2
        AND gf.overall_rating IS NOT NULL
        AND gf.created_at > CURRENT_TIMESTAMP - INTERVAL '12 months'
      GROUP BY r.room_type_id
      `,
      [roomTypeIds, queryParams.tenantId],
    );

    // Fetch conversion rates from recommendation_interactions (last 90 days)
    const conversionResult = await query<{
      room_type_id: string;
      conversion_rate: string | null;
    }>(
      `
      SELECT
        room_type_id,
        AVG(CASE WHEN booked THEN 1.0 ELSE 0.0 END)::DECIMAL(5,4) AS conversion_rate
      FROM recommendation_interactions
      WHERE room_type_id = ANY($1::uuid[])
        AND tenant_id = $2
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '90 days'
      GROUP BY room_type_id
      `,
      [roomTypeIds, queryParams.tenantId],
    );

    // Build lookup maps
    const feedbackMap = new Map(feedbackResult.rows.map((row) => [row.room_type_id, row]));
    const conversionMap = new Map(
      conversionResult.rows.map((row) => [
        row.room_type_id,
        Number.parseFloat(row.conversion_rate ?? "0"),
      ]),
    );

    return candidates.map((c) => {
      const fb = feedbackMap.get(c.roomTypeId);
      if (!fb || Number.parseInt(fb.review_count, 10) === 0) {
        return {}; // No feedback data — scorer will use defaults
      }

      const feedbackStats: RoomFeedbackStats = {
        avgRating: Number.parseFloat(fb.avg_rating ?? "0"),
        reviewCount: Number.parseInt(fb.review_count, 10),
        wouldReturnRate: Number.parseFloat(fb.would_return_rate ?? "0"),
        avgSentiment: Number.parseFloat(fb.avg_sentiment ?? "0"),
        avgCleanliness: Number.parseFloat(fb.avg_cleanliness ?? "0"),
        avgComfort: Number.parseFloat(fb.avg_comfort ?? "0"),
        avgValue: Number.parseFloat(fb.avg_value ?? "0"),
        avgAmenities: Number.parseFloat(fb.avg_amenities ?? "0"),
        conversionRate: conversionMap.get(c.roomTypeId) ?? 0,
      };

      return { feedbackStats };
    });
  }
}
