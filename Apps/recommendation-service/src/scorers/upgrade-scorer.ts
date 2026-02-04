/**
 * UpgradeScorer - Scores upgrade opportunities.
 *
 * Gives a boost to rooms that represent good upgrade value.
 */

import { BaseScorer, type PipelineContext } from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class UpgradeScorer extends BaseScorer<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "upgrade";
  readonly weight = 0.2; // 20% of final score

  /**
   * Only enable for guests who might be interested in upgrades.
   */
  enable(queryParams: RoomRecommendationQuery): boolean {
    return (
      queryParams.loyaltyTier !== undefined &&
      queryParams.loyaltyTier !== "none"
    );
  }

  async score(
    queryParams: RoomRecommendationQuery,
    candidates: readonly RoomCandidate[],
    context: PipelineContext,
  ): Promise<number[]> {
    context.logger.debug(
      {
        candidateCount: candidates.length,
        loyaltyTier: queryParams.loyaltyTier,
      },
      "Scoring upgrade opportunities",
    );

    const loyaltyMultiplier = this.getLoyaltyMultiplier(queryParams.loyaltyTier);

    return candidates.map((candidate) => {
      if (!candidate.isUpgrade) {
        return 0.3; // Base score for non-upgrades
      }

      let score = 0.5;

      // Higher discount = more attractive upgrade
      if (candidate.upgradeDiscount) {
        score += candidate.upgradeDiscount / 100 * loyaltyMultiplier;
      }

      // Better views get a boost
      if (candidate.viewType && ["ocean", "city", "garden"].includes(candidate.viewType)) {
        score += 0.1;
      }

      // Higher floors (premium) get a slight boost
      const floorNum = typeof candidate.floor === 'string' ? parseInt(candidate.floor, 10) : candidate.floor;
      if (!isNaN(floorNum) && floorNum >= 10) {
        score += 0.1;
      }

      // More amenities = better upgrade
      const amenityCount = candidate.amenities?.length ?? 0;
      score += Math.min(amenityCount * 0.02, 0.2);

      return Math.min(1, Math.max(0, score));
    });
  }

  private getLoyaltyMultiplier(tier?: string): number {
    switch (tier) {
      case "platinum":
        return 1.5;
      case "gold":
        return 1.3;
      case "silver":
        return 1.15;
      default:
        return 1.0;
    }
  }
}
