/**
 * Hydrator interface for enriching candidates with additional data.
 *
 * Hydrators run after sourcing to add metadata, features, and other
 * information needed for filtering and scoring.
 *
 * @example
 * ```typescript
 * class RoomDetailsHydrator implements Hydrator<RoomQuery, RoomCandidate> {
 *   name = "room_details";
 *
 *   async hydrate(query: RoomQuery, candidates: RoomCandidate[]): Promise<Partial<RoomCandidate>[]> {
 *     const roomIds = candidates.map(c => c.roomId);
 *     const details = await roomsService.getDetails(roomIds);
 *     return details.map(d => ({ amenities: d.amenities, photos: d.photos }));
 *   }
 *
 *   updateAll(candidates: RoomCandidate[], hydrated: Partial<RoomCandidate>[]): void {
 *     candidates.forEach((c, i) => Object.assign(c, hydrated[i]));
 *   }
 * }
 * ```
 */

import type { HasRequestId, PipelineContext } from "./types.js";

/**
 * A hydrator enriches candidates with additional data.
 *
 * @typeParam Q - Query type (must have requestId)
 * @typeParam C - Candidate type
 */
export interface Hydrator<Q extends HasRequestId, C> {
  /**
   * Unique name for this hydrator (used in logging/metrics).
   */
  readonly name: string;

  /**
   * Whether this hydrator should run for the given query.
   *
   * @param query - The pipeline query
   * @returns true if the hydrator should run
   */
  enable(query: Q): boolean;

  /**
   * Fetch additional data for the candidates.
   * The returned array must have the same length as the input candidates.
   *
   * @param query - The hydrated query
   * @param candidates - Current candidates
   * @param context - Pipeline execution context
   * @returns Array of partial candidate data to merge (same order as input)
   */
  hydrate(query: Q, candidates: readonly C[], context: PipelineContext): Promise<Partial<C>[]>;

  /**
   * Merge the hydrated data into the candidates.
   * Called after hydrate() succeeds.
   *
   * @param candidates - The candidates to update (mutated in place)
   * @param hydrated - The data returned from hydrate()
   */
  updateAll(candidates: C[], hydrated: Partial<C>[]): void;
}

/**
 * Abstract base class for hydrators with common functionality.
 */
export abstract class BaseHydrator<Q extends HasRequestId, C extends object>
  implements Hydrator<Q, C>
{
  abstract readonly name: string;

  /**
   * Override to conditionally enable this hydrator.
   * Default: always enabled.
   */
  enable(_query: Q): boolean {
    return true;
  }

  abstract hydrate(
    query: Q,
    candidates: readonly C[],
    context: PipelineContext,
  ): Promise<Partial<C>[]>;

  /**
   * Default updateAll implementation using Object.assign.
   * Override for custom merge logic.
   */
  updateAll(candidates: C[], hydrated: Partial<C>[]): void {
    for (let i = 0; i < candidates.length; i++) {
      if (hydrated[i]) {
        Object.assign(candidates[i], hydrated[i]);
      }
    }
  }
}
