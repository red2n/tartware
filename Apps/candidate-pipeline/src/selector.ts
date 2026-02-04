/**
 * Selector interface for sorting and selecting top candidates.
 *
 * The selector runs after scoring to produce the final ranked list.
 *
 * @example
 * ```typescript
 * class TopKScoreSelector implements Selector<RoomQuery, RoomCandidate> {
 *   name = "top_k_score";
 *
 *   select(query: RoomQuery, candidates: RoomCandidate[]): RoomCandidate[] {
 *     return candidates
 *       .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
 *       .slice(0, query.limit);
 *   }
 * }
 * ```
 */

import type { HasRequestId, HasScore } from "./types.js";

/**
 * A selector sorts and selects the final set of candidates.
 *
 * @typeParam Q - Query type (must have requestId)
 * @typeParam C - Candidate type (should have score field)
 */
export interface Selector<Q extends HasRequestId, C extends HasScore> {
  /**
   * Unique name for this selector (used in logging/metrics).
   */
  readonly name: string;

  /**
   * Whether this selector should run for the given query.
   *
   * @param query - The pipeline query
   * @returns true if the selector should run
   */
  enable(query: Q): boolean;

  /**
   * Sort and select candidates.
   *
   * @param query - The hydrated query
   * @param candidates - Scored candidates
   * @returns Selected candidates in ranked order
   */
  select(query: Q, candidates: C[]): C[];
}

/**
 * Default selector that sorts by score descending and takes top K.
 */
export class TopKScoreSelector<Q extends HasRequestId, C extends HasScore>
  implements Selector<Q, C>
{
  readonly name = "top_k_score";
  private readonly defaultLimit: number;

  constructor(defaultLimit = 10) {
    this.defaultLimit = defaultLimit;
  }

  enable(_query: Q): boolean {
    return true;
  }

  /**
   * Get the limit from the query or use default.
   * Override this to customize limit extraction.
   */
  protected getLimit(query: Q): number {
    return (query as unknown as { limit?: number }).limit ?? this.defaultLimit;
  }

  select(query: Q, candidates: C[]): C[] {
    const limit = this.getLimit(query);

    return candidates
      .slice() // Don't mutate original
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  }
}

/**
 * Selector that applies diversity constraints to prevent
 * too many similar items (e.g., same room type).
 */
export abstract class DiversitySelector<Q extends HasRequestId, C extends HasScore>
  implements Selector<Q, C>
{
  abstract readonly name: string;
  abstract readonly maxPerGroup: number;

  enable(_query: Q): boolean {
    return true;
  }

  /**
   * Extract the group key from a candidate.
   * Candidates with the same key are considered similar.
   */
  abstract getGroupKey(candidate: C): string;

  select(query: Q, candidates: C[]): C[] {
    const limit = (query as unknown as { limit?: number }).limit ?? 10;
    const groupCounts = new Map<string, number>();
    const selected: C[] = [];

    // Sort by score first
    const sorted = candidates.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    for (const candidate of sorted) {
      if (selected.length >= limit) break;

      const key = this.getGroupKey(candidate);
      const count = groupCounts.get(key) ?? 0;

      if (count < this.maxPerGroup) {
        selected.push(candidate);
        groupCounts.set(key, count + 1);
      }
    }

    return selected;
  }
}
