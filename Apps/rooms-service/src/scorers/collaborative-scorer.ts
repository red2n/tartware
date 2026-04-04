/**
 * CollaborativeScorer - "Guests like you also liked..."
 *
 * Implements item-based collaborative filtering using guest feedback data.
 * Finds room types that similar guests rated highly and boosts those candidates.
 *
 * Similarity dimensions:
 *  - Loyalty tier (same tier guests have similar expectations)
 *  - Spending bracket (similar avg nightly rate ±20%)
 *  - Stay purpose / booking history patterns
 *
 * Industry reference: Amazon's item-item collaborative filtering approach,
 * adapted for hotel rooms where the "item space" is room types (not individual rooms).
 */

import { BaseScorer, type PipelineContext } from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

/** How many similar guests to consider for collaborative signals */
const SIMILAR_GUEST_POOL_SIZE = 50;

/** Minimum overlap (shared room type bookings) to consider a guest "similar" */
const MIN_OVERLAP_BOOKINGS = 1;

export class CollaborativeScorer extends BaseScorer<RoomRecommendationQuery, RoomCandidate> {
  readonly name = "collaborative";
  override readonly weight = 0.15; // 15% of final score

  /**
   * Only enable collaborative scoring when we have a guest with history.
   */
  override enable(queryParams: RoomRecommendationQuery): boolean {
    return queryParams.guestId !== undefined && queryParams.guestHistory !== undefined;
  }

  async score(
    queryParams: RoomRecommendationQuery,
    candidates: readonly RoomCandidate[],
    context: PipelineContext,
  ): Promise<number[]> {
    context.logger.debug(
      { candidateCount: candidates.length, guestId: queryParams.guestId },
      "Scoring by collaborative filtering",
    );

    const roomTypeIds = [...new Set(candidates.map((c) => c.roomTypeId))];

    // Find room types that similar guests rated highly.
    // "Similar" = same loyalty tier + overlapping room type history + similar spend.
    const collaborativeSignals = await query<{
      room_type_id: string;
      similar_guest_avg_rating: string;
      similar_guest_count: string;
      similar_guest_would_return_rate: string;
    }>(
      `
      WITH current_guest AS (
        SELECT
          g.loyalty_tier,
          COALESCE(
            (SELECT AVG(rt.base_price)
             FROM reservations res
             JOIN rooms r ON res.room_number = r.room_number AND res.tenant_id = r.tenant_id
             JOIN room_types rt ON r.room_type_id = rt.id
             WHERE res.guest_id = $1 AND res.tenant_id = $2
             LIMIT 20),
            0
          ) AS avg_spend,
          ARRAY(
            SELECT DISTINCT r.room_type_id
            FROM reservations res
            JOIN rooms r ON res.room_number = r.room_number AND res.tenant_id = r.tenant_id
            WHERE res.guest_id = $1 AND res.tenant_id = $2
          ) AS booked_room_types
        FROM guests g
        WHERE g.id = $1 AND g.tenant_id = $2
      ),
      similar_guests AS (
        SELECT DISTINCT gf.guest_id
        FROM guest_feedback gf
        JOIN reservations res ON gf.reservation_id = res.id
        JOIN rooms r ON res.room_number = r.room_number AND res.tenant_id = r.tenant_id
        JOIN guests g ON gf.guest_id = g.id
        CROSS JOIN current_guest cg
        WHERE gf.tenant_id = $2
          AND gf.guest_id != $1
          AND gf.overall_rating IS NOT NULL
          AND gf.created_at > CURRENT_TIMESTAMP - INTERVAL '24 months'
          -- Same loyalty tier OR similar spending (±30%)
          AND (
            g.loyalty_tier = cg.loyalty_tier
            OR (cg.avg_spend > 0 AND ABS(
              (SELECT AVG(rt2.base_price)
               FROM reservations res2
               JOIN rooms r2 ON res2.room_number = r2.room_number AND res2.tenant_id = r2.tenant_id
               JOIN room_types rt2 ON r2.room_type_id = rt2.id
               WHERE res2.guest_id = gf.guest_id AND res2.tenant_id = $2
               LIMIT 20
              ) - cg.avg_spend
            ) / NULLIF(cg.avg_spend, 0) < 0.3)
          )
          -- Must have at least 1 overlapping room type booking
          AND r.room_type_id = ANY(cg.booked_room_types)
        LIMIT $3
      )
      SELECT
        r.room_type_id,
        AVG(gf.overall_rating)::DECIMAL(3,2) AS similar_guest_avg_rating,
        COUNT(DISTINCT gf.guest_id)::TEXT AS similar_guest_count,
        AVG(CASE WHEN gf.would_return THEN 1.0 ELSE 0.0 END)::DECIMAL(3,2) AS similar_guest_would_return_rate
      FROM guest_feedback gf
      JOIN similar_guests sg ON gf.guest_id = sg.guest_id
      JOIN reservations res ON gf.reservation_id = res.id
      JOIN rooms r ON res.room_number = r.room_number AND res.tenant_id = r.tenant_id
      WHERE r.room_type_id = ANY($4::uuid[])
        AND gf.tenant_id = $2
        AND gf.overall_rating IS NOT NULL
      GROUP BY r.room_type_id
      HAVING COUNT(DISTINCT gf.guest_id) >= $5
      `,
      [
        queryParams.guestId,
        queryParams.tenantId,
        SIMILAR_GUEST_POOL_SIZE,
        roomTypeIds,
        MIN_OVERLAP_BOOKINGS,
      ],
    );

    // Build signal map
    const signalMap = new Map(
      collaborativeSignals.rows.map((row) => [
        row.room_type_id,
        {
          avgRating: Number.parseFloat(row.similar_guest_avg_rating),
          guestCount: Number.parseInt(row.similar_guest_count, 10),
          wouldReturnRate: Number.parseFloat(row.similar_guest_would_return_rate),
        },
      ]),
    );

    return candidates.map((candidate) => {
      const signal = signalMap.get(candidate.roomTypeId);

      if (!signal) {
        return 0.5; // No collaborative data — neutral
      }

      // Rating from similar guests (normalized to 0-1)
      const ratingScore = signal.avgRating / 5.0;

      // Would-return rate from similar guests
      const returnScore = signal.wouldReturnRate;

      // Confidence based on how many similar guests we found
      const confidence = Math.min(1, signal.guestCount / 10);

      // Weighted combination
      const rawScore = ratingScore * 0.6 + returnScore * 0.4;

      // Dampen toward neutral for low-confidence signals
      return Math.min(1, Math.max(0, 0.5 * (1 - confidence) + rawScore * confidence));
    });
  }
}
