/**
 * DuplicateFilter - Removes duplicate room candidates.
 *
 * Multiple sources may return the same room. This filter ensures
 * each room appears only once, keeping the first occurrence.
 */

import {
  type FilterResult,
  type PipelineContext,
  PredicateFilter,
} from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

class DuplicateFilter extends PredicateFilter<RoomRecommendationQuery, RoomCandidate> {
  readonly name = "duplicate";
  private seenRoomIds = new Set<string>();

  override async filter(
    query: RoomRecommendationQuery,
    candidates: RoomCandidate[],
    context: PipelineContext,
  ): Promise<FilterResult<RoomCandidate>> {
    // Reset per-execution state so the filter works correctly across pipeline reuse
    this.seenRoomIds.clear();
    return super.filter(query, candidates, context);
  }

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
