/**
 * QueryHydrator interface for enriching queries with additional context.
 *
 * Query hydrators run before candidate sourcing to add user context,
 * preferences, and other data needed for personalization.
 *
 * @example
 * ```typescript
 * class GuestHistoryHydrator implements QueryHydrator<RoomQuery> {
 *   name = "guest_history";
 *
 *   async hydrate(query: RoomQuery): Promise<Partial<RoomQuery>> {
 *     const history = await guestService.getBookingHistory(query.guestId);
 *     return { guestHistory: history };
 *   }
 *
 *   update(query: RoomQuery, hydrated: Partial<RoomQuery>): void {
 *     Object.assign(query, hydrated);
 *   }
 * }
 * ```
 */

import type { HasRequestId, PipelineContext } from "./types.js";

/**
 * A query hydrator enriches the query with additional context before sourcing.
 *
 * @typeParam Q - Query type (must have requestId)
 */
export interface QueryHydrator<Q extends HasRequestId> {
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
   * Fetch additional data to hydrate into the query.
   *
   * @param query - The current query state
   * @param context - Pipeline execution context
   * @returns Partial query data to merge
   */
  hydrate(query: Q, context: PipelineContext): Promise<Partial<Q>>;

  /**
   * Merge the hydrated data into the query.
   * Called after hydrate() succeeds.
   *
   * @param query - The query to update (mutated in place)
   * @param hydrated - The data returned from hydrate()
   */
  update(query: Q, hydrated: Partial<Q>): void;
}

/**
 * Abstract base class for query hydrators with common functionality.
 */
export abstract class BaseQueryHydrator<Q extends HasRequestId> implements QueryHydrator<Q> {
  abstract readonly name: string;

  /**
   * Override to conditionally enable this hydrator.
   * Default: always enabled.
   */
  enable(_query: Q): boolean {
    return true;
  }

  abstract hydrate(query: Q, context: PipelineContext): Promise<Partial<Q>>;

  /**
   * Default update implementation using Object.assign.
   * Override for custom merge logic.
   */
  update(query: Q, hydrated: Partial<Q>): void {
    Object.assign(query, hydrated);
  }
}
