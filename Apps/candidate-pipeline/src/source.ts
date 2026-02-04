/**
 * Source interface for fetching candidates from a data source.
 *
 * Sources are the starting point of the pipeline. Multiple sources
 * can run in parallel and their results are merged.
 *
 * @example
 * ```typescript
 * class AvailableRoomsSource implements Source<RoomQuery, RoomCandidate> {
 *   name = "available_rooms";
 *
 *   async getCandidates(query: RoomQuery): Promise<RoomCandidate[]> {
 *     return await roomsService.getAvailable(query.propertyId, query.dates);
 *   }
 * }
 * ```
 */

import type { HasRequestId, PipelineContext } from "./types.js";

/**
 * A source fetches candidates from an external data source.
 *
 * @typeParam Q - Query type (must have requestId)
 * @typeParam C - Candidate type
 */
export interface Source<Q extends HasRequestId, C> {
  /**
   * Unique name for this source (used in logging/metrics).
   */
  readonly name: string;

  /**
   * Whether this source should run for the given query.
   * Use this to conditionally enable/disable sources based on query params.
   *
   * @param query - The pipeline query
   * @returns true if the source should fetch candidates
   */
  enable(query: Q): boolean;

  /**
   * Fetch candidates from the data source.
   *
   * @param query - The hydrated pipeline query
   * @param context - Pipeline execution context
   * @returns Array of candidates
   */
  getCandidates(query: Q, context: PipelineContext): Promise<C[]>;
}

/**
 * Abstract base class for sources with common functionality.
 */
export abstract class BaseSource<Q extends HasRequestId, C> implements Source<Q, C> {
  abstract readonly name: string;

  /**
   * Override to conditionally enable this source.
   * Default: always enabled.
   */
  enable(_query: Q): boolean {
    return true;
  }

  abstract getCandidates(query: Q, context: PipelineContext): Promise<C[]>;
}
