/**
 * ValueScorer - Scores rooms based on value proposition.
 *
 * Considers price relative to guest's history and upgrade opportunities.
 */

import { BaseScorer, type PipelineContext } from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class ValueScorer extends BaseScorer<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "value";
  readonly weight = 0.25; // 25% of final score

  async score(
    queryParams: RoomRecommendationQuery,
    candidates: readonly RoomCandidate[],
    context: PipelineContext,
  ): Promise<number[]> {
    context.logger.debug(
      { candidateCount: candidates.length },
      "Scoring by value proposition",
    );

    const avgRate = queryParams.guestHistory?.averageRate ?? 150;
    const budgetMax = queryParams.budgetRange?.max ?? avgRate * 1.5;

    return candidates.map((candidate) => {
      const rate = candidate.dynamicRate ?? candidate.baseRate;
      let score = 0.5;

      // Good value: rate near or below average
      if (rate <= avgRate) {
        score += 0.2;
      } else if (rate <= avgRate * 1.1) {
        score += 0.1;
      }

      // Upgrade opportunities get a boost
      if (candidate.isUpgrade && candidate.upgradeDiscount) {
        // Higher discount = higher score
        score += candidate.upgradeDiscount / 100;
      }

      // Penalize if significantly over budget
      if (rate > budgetMax * 1.2) {
        score -= 0.3;
      }

      // Boost for rooms with good amenity-to-price ratio
      const amenityCount = candidate.amenities?.length ?? 0;
      if (amenityCount > 5 && rate < avgRate * 1.2) {
        score += 0.15;
      }

      return Math.min(1, Math.max(0, score));
    });
  }
}
