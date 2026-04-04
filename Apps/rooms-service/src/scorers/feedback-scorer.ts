/**
 * FeedbackScorer - Scores rooms based on aggregate guest satisfaction data.
 *
 * Uses real guest feedback (ratings, sentiment, would-return signals) and
 * recommendation conversion rates to score candidates. This is the primary
 * signal that distinguishes a true recommendation engine from a rule-based
 * ranker.
 *
 * Scoring dimensions:
 *  - Overall rating (normalized to 0-1)
 *  - Would-return rate (strongest loyalty signal)
 *  - Sentiment score (NLP-derived guest satisfaction)
 *  - Conversion rate (did past recommendations lead to bookings?)
 *  - Review volume confidence (Bayesian smoothing for sparse data)
 *
 * Industry reference: Netflix-style Bayesian rating with temporal decay.
 */

import { BaseScorer, type PipelineContext } from "@tartware/candidate-pipeline";

import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

/** Minimum reviews needed before feedback carries full weight (Bayesian prior) */
const MIN_REVIEWS_FOR_CONFIDENCE = 5;

/** Global prior rating when no reviews exist (3.5/5 = neutral) */
const PRIOR_RATING = 3.5;

export class FeedbackScorer extends BaseScorer<RoomRecommendationQuery, RoomCandidate> {
  readonly name = "feedback";
  override readonly weight = 0.25; // 25% of final score

  async score(
    _queryParams: RoomRecommendationQuery,
    candidates: readonly RoomCandidate[],
    context: PipelineContext,
  ): Promise<number[]> {
    context.logger.debug({ candidateCount: candidates.length }, "Scoring by guest feedback");

    return candidates.map((candidate) => {
      const fb = candidate.feedbackStats;

      // No feedback data — return neutral score (will be improved by Bayesian prior)
      if (!fb || fb.reviewCount === 0) {
        return 0.5;
      }

      // ─── 1. Bayesian-smoothed rating (handles sparse data) ──────────
      // C = prior strength, m = prior mean, R = observed mean, v = review count
      // Bayesian avg = (C * m + v * R) / (C + v)
      const bayesianRating =
        (MIN_REVIEWS_FOR_CONFIDENCE * PRIOR_RATING + fb.reviewCount * fb.avgRating) /
        (MIN_REVIEWS_FOR_CONFIDENCE + fb.reviewCount);
      const ratingScore = bayesianRating / 5.0; // Normalize to 0-1

      // ─── 2. Would-return signal (strongest guest loyalty indicator) ─
      const returnScore = fb.wouldReturnRate; // Already 0-1

      // ─── 3. Sentiment score (NLP-derived) ───────────────────────────
      // Sentiment is -1 to 1, normalize to 0-1
      const sentimentScore = (fb.avgSentiment + 1) / 2;

      // ─── 4. Conversion rate (recommendation effectiveness) ──────────
      // How often does showing this room type lead to a booking?
      const conversionScore = Math.min(1, fb.conversionRate * 5); // Scale up (20% conv = 1.0 score)

      // ─── 5. Review volume confidence ────────────────────────────────
      // More reviews = higher confidence = full weight
      const confidenceFactor = Math.min(1, fb.reviewCount / MIN_REVIEWS_FOR_CONFIDENCE);

      // ─── Weighted combination ───────────────────────────────────────
      const rawScore =
        ratingScore * 0.35 + // Overall guest satisfaction
        returnScore * 0.3 + // Loyalty intent
        sentimentScore * 0.15 + // NLP sentiment
        conversionScore * 0.2; // Conversion effectiveness

      // Apply confidence dampening — low-review rooms score closer to neutral
      const finalScore = 0.5 * (1 - confidenceFactor) + rawScore * confidenceFactor;

      return Math.min(1, Math.max(0, finalScore));
    });
  }
}
