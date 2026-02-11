/**
 * PreferenceScorer - Scores rooms based on match to guest preferences.
 *
 * This is a rule-based scorer that can be replaced with an ML model later.
 * It predicts the probability that a guest will book a room based on
 * historical preferences.
 */

import { BaseScorer, type PipelineContext } from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class PreferenceScorer extends BaseScorer<RoomRecommendationQuery, RoomCandidate> {
  readonly name = "preference";
  override readonly weight = 0.4; // 40% of final score

  async score(
    queryParams: RoomRecommendationQuery,
    candidates: readonly RoomCandidate[],
    context: PipelineContext,
  ): Promise<number[]> {
    context.logger.debug({ candidateCount: candidates.length }, "Scoring by preference match");

    const history = queryParams.guestHistory;
    const preferences = queryParams.guestPreferences;

    return candidates.map((candidate) => {
      let score = 0.5; // Base score

      // Boost for previously booked room types
      if (history?.previousRoomTypes?.includes(candidate.roomTypeId)) {
        score += 0.2;
      }

      // Boost for preferred amenities
      if (history?.preferredAmenities && candidate.amenities) {
        const matchingAmenities = history.preferredAmenities.filter((a) =>
          candidate.amenities!.includes(a),
        );
        score += matchingAmenities.length * 0.05;
      }

      // Floor preference match
      if (preferences?.floorPreference) {
        const floorNum =
          typeof candidate.floor === "string" ? parseInt(candidate.floor, 10) : candidate.floor;
        if (!Number.isNaN(floorNum)) {
          if (preferences.floorPreference === "high" && floorNum >= 5) {
            score += 0.1;
          } else if (preferences.floorPreference === "low" && floorNum <= 2) {
            score += 0.1;
          }
        }
      }

      // View preference match
      if (preferences?.viewPreferences && candidate.viewType) {
        if (preferences.viewPreferences.includes(candidate.viewType)) {
          score += 0.15;
        }
      }

      // Preferred room types
      if (preferences?.preferredRoomTypes?.includes(candidate.roomTypeId)) {
        score += 0.15;
      }

      // Normalize to 0-1 range
      return Math.min(1, Math.max(0, score));
    });
  }
}
