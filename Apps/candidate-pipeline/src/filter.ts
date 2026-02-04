/**
 * Filter interface for removing ineligible candidates.
 *
 * Filters run after hydration to remove candidates that should not
 * be shown to the user (e.g., unavailable rooms, blocked dates).
 *
 * @example
 * ```typescript
 * class MaintenanceFilter implements Filter<RoomQuery, RoomCandidate> {
 *   name = "maintenance";
 *
 *   async filter(query: RoomQuery, candidates: RoomCandidate[]): Promise<FilterResult<RoomCandidate>> {
 *     const kept: RoomCandidate[] = [];
 *     const removed: RoomCandidate[] = [];
 *
 *     for (const candidate of candidates) {
 *       if (candidate.status === 'maintenance') {
 *         removed.push(candidate);
 *       } else {
 *         kept.push(candidate);
 *       }
 *     }
 *
 *     return { kept, removed };
 *   }
 * }
 * ```
 */

import type { FilterResult, HasRequestId, PipelineContext } from "./types.js";

/**
 * A filter partitions candidates into kept and removed sets.
 *
 * @typeParam Q - Query type (must have requestId)
 * @typeParam C - Candidate type
 */
export interface Filter<Q extends HasRequestId, C> {
  /**
   * Unique name for this filter (used in logging/metrics).
   */
  readonly name: string;

  /**
   * Whether this filter should run for the given query.
   *
   * @param query - The pipeline query
   * @returns true if the filter should run
   */
  enable(query: Q): boolean;

  /**
   * Partition candidates into kept and removed sets.
   *
   * @param query - The hydrated query
   * @param candidates - Current candidates
   * @param context - Pipeline execution context
   * @returns FilterResult with kept and removed arrays
   */
  filter(query: Q, candidates: C[], context: PipelineContext): Promise<FilterResult<C>>;
}

/**
 * Abstract base class for filters with common functionality.
 */
export abstract class BaseFilter<Q extends HasRequestId, C> implements Filter<Q, C> {
  abstract readonly name: string;

  /**
   * Override to conditionally enable this filter.
   * Default: always enabled.
   */
  enable(_query: Q): boolean {
    return true;
  }

  abstract filter(query: Q, candidates: C[], context: PipelineContext): Promise<FilterResult<C>>;

  /**
   * Helper to create a FilterResult from a predicate function.
   */
  protected partitionBy(candidates: C[], predicate: (candidate: C) => boolean): FilterResult<C> {
    const kept: C[] = [];
    const removed: C[] = [];

    for (const candidate of candidates) {
      if (predicate(candidate)) {
        kept.push(candidate);
      } else {
        removed.push(candidate);
      }
    }

    return { kept, removed };
  }
}

/**
 * A synchronous filter for simple predicate-based filtering.
 */
export abstract class PredicateFilter<Q extends HasRequestId, C> extends BaseFilter<Q, C> {
  /**
   * Return true to keep the candidate, false to remove it.
   */
  abstract shouldKeep(query: Q, candidate: C): boolean;

  async filter(query: Q, candidates: C[], _context: PipelineContext): Promise<FilterResult<C>> {
    return this.partitionBy(candidates, (c) => this.shouldKeep(query, c));
  }
}
