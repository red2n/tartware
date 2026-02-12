/**
 * Scorer interface for computing relevance scores.
 *
 * Scorers run after filtering to predict engagement and compute
 * final scores for ranking. Multiple scorers can be chained.
 *
 * @example
 * ```typescript
 * class PreferenceScorer implements Scorer<RoomQuery, RoomCandidate> {
 *   name = "preference";
 *
 *   async score(query: RoomQuery, candidates: RoomCandidate[]): Promise<number[]> {
 *     // Call ML model to predict booking probability
 *     const predictions = await mlClient.predict(query.guestFeatures, candidates);
 *     return predictions.map(p => p.bookingProbability);
 *   }
 *
 *   updateAll(candidates: RoomCandidate[], scores: number[]): void {
 *     candidates.forEach((c, i) => {
 *       c.scores = c.scores ?? {};
 *       c.scores.preference = scores[i];
 *       c.score = (c.score ?? 0) + scores[i] * this.weight;
 *     });
 *   }
 * }
 * ```
 */

import type { HasRequestId, HasScore, PipelineContext } from "./types.js";

/**
 * A scorer computes relevance scores for candidates.
 *
 * @typeParam Q - Query type (must have requestId)
 * @typeParam C - Candidate type (should have score field)
 */
export interface Scorer<Q extends HasRequestId, C extends HasScore> {
  /**
   * Unique name for this scorer (used in logging/metrics).
   */
  readonly name: string;

  /**
   * Weight to apply to this scorer's output in the final score.
   */
  readonly weight: number;

  /**
   * Whether this scorer should run for the given query.
   *
   * @param query - The pipeline query
   * @returns true if the scorer should run
   */
  enable(query: Q): boolean;

  /**
   * Compute scores for the candidates.
   * The returned array must have the same length as the input candidates.
   *
   * @param query - The hydrated query
   * @param candidates - Current candidates
   * @param context - Pipeline execution context
   * @returns Array of scores (same order as input)
   */
  score(query: Q, candidates: readonly C[], context: PipelineContext): Promise<number[]>;

  /**
   * Apply the computed scores to the candidates.
   * Called after score() succeeds.
   *
   * @param candidates - The candidates to update (mutated in place)
   * @param scores - The scores returned from score()
   */
  updateAll(candidates: C[], scores: number[]): void;
}

/**
 * Abstract base class for scorers with common functionality.
 */
export abstract class BaseScorer<Q extends HasRequestId, C extends HasScore>
  implements Scorer<Q, C>
{
  abstract readonly name: string;
  readonly weight: number = 1.0;

  /**
   * Override to conditionally enable this scorer.
   * Default: always enabled.
   */
  enable(_query: Q): boolean {
    return true;
  }

  abstract score(query: Q, candidates: readonly C[], context: PipelineContext): Promise<number[]>;

  /**
   * Default updateAll implementation that:
   * 1. Stores the score in candidate.scores[name]
   * 2. Adds weighted score to candidate.score
   */
  updateAll(candidates: C[], scores: number[]): void {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      const scoreValue = scores[i] ?? 0;

      // Store individual score
      candidate.scores = candidate.scores ?? {};
      candidate.scores[this.name] = scoreValue;

      // Add to cumulative score
      candidate.score = (candidate.score ?? 0) + scoreValue * this.weight;
    }
  }
}

/**
 * A weighted scorer that combines multiple action predictions.
 * Similar to X's weighted engagement scorer.
 */
export abstract class WeightedActionScorer<
  Q extends HasRequestId,
  C extends HasScore,
> extends BaseScorer<Q, C> {
  /**
   * Weights for each action type. Positive for desired actions,
   * negative for undesired actions.
   */
  abstract readonly actionWeights: Record<string, number>;

  /**
   * Compute predictions for each action type.
   * Returns a map from action name to array of probabilities.
   */
  abstract predictActions(
    query: Q,
    candidates: readonly C[],
    context: PipelineContext,
  ): Promise<Record<string, number[]>>;

  async score(query: Q, candidates: readonly C[], context: PipelineContext): Promise<number[]> {
    const predictions = await this.predictActions(query, candidates, context);
    const scores: number[] = new Array(candidates.length).fill(0);

    for (const [action, weight] of Object.entries(this.actionWeights)) {
      const actionScores = predictions[action];
      if (actionScores) {
        for (let i = 0; i < scores.length; i++) {
          scores[i] = (scores[i] ?? 0) + (actionScores[i] ?? 0) * weight;
        }
      }
    }

    return scores;
  }
}
