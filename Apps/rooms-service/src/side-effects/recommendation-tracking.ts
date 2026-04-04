/**
 * RecommendationTrackingSideEffect - Records what was recommended for feedback loop.
 *
 * After the pipeline selects candidates, this side effect asynchronously inserts
 * rows into recommendation_interactions with interaction_type='shown'.
 *
 * These records are later updated when:
 *  - A guest views details (interaction_type → 'viewed')
 *  - A guest books a room (booked → true, reservation_id populated)
 *  - Post-stay feedback arrives (post_stay_rating backfilled)
 *
 * This closes the recommendation feedback loop and feeds the FeedbackScorer
 * and CollaborativeScorer with conversion data.
 */

import {
  BaseSideEffect,
  type PipelineContext,
  type SideEffectInput,
} from "@tartware/candidate-pipeline";

import { query } from "../lib/db.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class RecommendationTrackingSideEffect extends BaseSideEffect<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "recommendation_tracking";

  async run(
    input: SideEffectInput<RoomRecommendationQuery, RoomCandidate>,
    context: PipelineContext,
  ): Promise<void> {
    const { query: queryParams, selectedCandidates } = input;

    if (selectedCandidates.length === 0) {
      return;
    }

    context.logger.debug(
      {
        requestId: queryParams.requestId,
        candidateCount: selectedCandidates.length,
      },
      "Recording recommendation interactions",
    );

    // Build batch INSERT — one row per recommended room
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (let i = 0; i < selectedCandidates.length; i++) {
      const candidate = selectedCandidates[i]!;
      const position = i + 1; // 1-based rank

      placeholders.push(
        `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
      );

      values.push(
        queryParams.tenantId,
        queryParams.propertyId,
        queryParams.requestId,
        queryParams.guestId ?? null,
        candidate.roomId,
        candidate.roomTypeId,
        position,
        candidate.score != null ? Math.min(1, Math.max(0, candidate.score)) : null,
        candidate.scores ?? null,
        candidate.source,
      );
    }

    await query(
      `
      INSERT INTO recommendation_interactions (
        tenant_id, property_id, recommendation_request_id,
        guest_id, room_id, room_type_id,
        position_shown, relevance_score_at_time, scoring_breakdown, source
      )
      VALUES ${placeholders.join(", ")}
      `,
      values,
    );
  }
}
