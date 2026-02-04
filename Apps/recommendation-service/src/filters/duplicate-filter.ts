/**
 * DuplicateFilter - Removes duplicate room candidates.
 *
 * Multiple sources may return the same room. This filter ensures
 * each room appears only once, keeping the first occurrence.
 */

import { PredicateFilter } from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class DuplicateFilter extends PredicateFilter<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "duplicate";
  private seenRoomIds = new Set<string>();

  shouldKeep(_query: RoomRecommendationQuery, candidate: RoomCandidate): boolean {
    if (this.seenRoomIds.has(candidate.roomId)) {
      return false;
    }
    this.seenRoomIds.add(candidate.roomId);
    return true;
  }
}

/**
 * Create a fresh duplicate filter for each pipeline run.
 */
export function createDuplicateFilter(): DuplicateFilter {
  return new DuplicateFilter();
}
