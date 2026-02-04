/**
 * MaintenanceFilter - Removes rooms that are under maintenance.
 *
 * Even though sources try to filter these, this provides a safety net.
 */

import { PredicateFilter } from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

const EXCLUDED_STATUSES = new Set([
  "maintenance",
  "out_of_service",
  "blocked",
  "renovation",
]);

export class MaintenanceFilter extends PredicateFilter<
  RoomRecommendationQuery,
  RoomCandidate
> {
  readonly name = "maintenance";

  shouldKeep(_query: RoomRecommendationQuery, candidate: RoomCandidate): boolean {
    return !EXCLUDED_STATUSES.has(candidate.status.toLowerCase());
  }
}
