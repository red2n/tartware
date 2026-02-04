/**
 * OccupancyFilter - Removes rooms that cannot accommodate the guest count.
 */

import { PredicateFilter } from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class OccupancyFilter extends PredicateFilter<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "occupancy";

  shouldKeep(query: RoomRecommendationQuery, candidate: RoomCandidate): boolean {
    const totalGuests = query.adults + query.children;
    const maxOccupancy = candidate.maxOccupancy ?? 2; // Default to 2 if not set
    return maxOccupancy >= totalGuests;
  }
}
