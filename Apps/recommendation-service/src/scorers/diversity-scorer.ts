/**
 * DiversityScorer - Adjusts scores to ensure diversity in results.
 *
 * Similar to X's Author Diversity Scorer, this attenuates scores
 * for repeated room types to ensure variety in recommendations.
 */

import { BaseScorer, type PipelineContext } from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class DiversityScorer extends BaseScorer<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "diversity";
  readonly weight = 0.15; // 15% of final score

  // Discount factor for each additional room of the same type
  private readonly attenuation = 0.7;

  async score(
    _queryParams: RoomRecommendationQuery,
    candidates: readonly RoomCandidate[],
    context: PipelineContext,
  ): Promise<number[]> {
    context.logger.debug(
      { candidateCount: candidates.length },
      "Scoring for diversity",
    );

    // Sort candidates by their current score (descending)
    const sorted = candidates
      .map((c, i) => ({ candidate: c, index: i, currentScore: c.score ?? 0 }))
      .sort((a, b) => b.currentScore - a.currentScore);

    // Track how many of each room type we've seen
    const roomTypeCounts = new Map<string, number>();
    const scores = new Array(candidates.length).fill(0);

    for (const item of sorted) {
      const roomTypeId = item.candidate.roomTypeId;
      const count = roomTypeCounts.get(roomTypeId) ?? 0;

      // Apply attenuation: 1.0 for first, 0.7 for second, 0.49 for third, etc.
      const diversityScore = Math.pow(this.attenuation, count);
      scores[item.index] = diversityScore;

      roomTypeCounts.set(roomTypeId, count + 1);
    }

    return scores;
  }
}
