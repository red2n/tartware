/**
 * SideEffect interface for async operations after selection.
 *
 * Side effects run after the pipeline completes and don't block
 * the response. Use for caching, logging, analytics, etc.
 *
 * @example
 * ```typescript
 * class CacheResultsSideEffect implements SideEffect<RoomQuery, RoomCandidate> {
 *   name = "cache_results";
 *
 *   async run(input: SideEffectInput<RoomQuery, RoomCandidate>): Promise<void> {
 *     await cache.set(
 *       `recommendations:${input.query.guestId}`,
 *       input.selectedCandidates,
 *       { ttl: 300 }
 *     );
 *   }
 * }
 * ```
 */

import type { HasRequestId, PipelineContext } from "./types.js";

/**
 * Input provided to side effects.
 */
export interface SideEffectInput<Q extends HasRequestId, C> {
  /** The final hydrated query */
  query: Q;
  /** The selected candidates (pipeline output) */
  selectedCandidates: readonly C[];
  /** All candidates that were filtered out */
  filteredCandidates: readonly C[];
}

/**
 * A side effect runs async operations after selection.
 *
 * @typeParam Q - Query type (must have requestId)
 * @typeParam C - Candidate type
 */
export interface SideEffect<Q extends HasRequestId, C> {
  /**
   * Unique name for this side effect (used in logging/metrics).
   */
  readonly name: string;

  /**
   * Whether this side effect should run for the given query.
   *
   * @param query - The pipeline query
   * @returns true if the side effect should run
   */
  enable(query: Q): boolean;

  /**
   * Execute the side effect.
   * Errors are logged but don't affect the pipeline result.
   *
   * @param input - The pipeline input and results
   * @param context - Pipeline execution context
   */
  run(input: SideEffectInput<Q, C>, context: PipelineContext): Promise<void>;
}

/**
 * Abstract base class for side effects with common functionality.
 */
export abstract class BaseSideEffect<Q extends HasRequestId, C> implements SideEffect<Q, C> {
  abstract readonly name: string;

  /**
   * Override to conditionally enable this side effect.
   * Default: always enabled.
   */
  enable(_query: Q): boolean {
    return true;
  }

  abstract run(input: SideEffectInput<Q, C>, context: PipelineContext): Promise<void>;
}
