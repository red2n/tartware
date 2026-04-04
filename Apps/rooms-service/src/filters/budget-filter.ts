/**
 * BudgetFilter - Removes rooms outside the guest's budget range.
 *
 * Only applies if the guest has a known budget preference.
 */

import { PredicateFilter } from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

export class BudgetFilter extends PredicateFilter<RoomRecommendationQuery, RoomCandidate> {
  readonly name = "budget";

  /**
   * Only enable if we have budget information.
   */
  override enable(query: RoomRecommendationQuery): boolean {
    return query.budgetRange !== undefined;
  }

  shouldKeep(query: RoomRecommendationQuery, candidate: RoomCandidate): boolean {
    const budget = query.budgetRange!;
    const rate = candidate.dynamicRate ?? candidate.baseRate;

    // Allow some flexibility (10% over budget for upgrades)
    const maxAllowed = candidate.isUpgrade ? budget.max * 1.1 : budget.max;

    return rate >= budget.min && rate <= maxAllowed;
  }
}
