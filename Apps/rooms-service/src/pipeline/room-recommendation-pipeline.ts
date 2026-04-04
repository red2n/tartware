/**
 * Room recommendation pipeline - assembles all components.
 */

import { PipelineBuilder, TopKScoreSelector } from "@tartware/candidate-pipeline";
import type { PinoLogger } from "@tartware/telemetry";

import { config } from "../config.js";
import {
  AccessibilityFilter,
  BudgetFilter,
  createDuplicateFilter,
  MaintenanceFilter,
  OccupancyFilter,
} from "../filters/index.js";
import {
  AmenityHydrator,
  FeedbackHydrator,
  PricingHydrator,
  RoomDetailsHydrator,
} from "../hydrators/index.js";
import { GuestHistoryHydrator, GuestPreferencesHydrator } from "../query-hydrators/index.js";
import {
  CollaborativeScorer,
  DiversityScorer,
  FeedbackScorer,
  PreferenceScorer,
  UpgradeScorer,
  ValueScorer,
} from "../scorers/index.js";
import { RecommendationTrackingSideEffect } from "../side-effects/index.js";
import {
  AvailableRoomsSource,
  SimilarRoomsSource,
  UpgradeOpportunitySource,
} from "../sources/index.js";
import type { RoomCandidate, RoomRecommendationQuery } from "../types.js";

/**
 * Build the room recommendation pipeline.
 *
 * Pipeline stages:
 * 1. Query Hydration: GuestHistory → GuestPreferences
 * 2. Sources: AvailableRooms, SimilarRooms, UpgradeOpportunity
 * 3. Hydration: RoomDetails, Amenity, Pricing, Feedback
 * 4. Filters: Duplicate, Maintenance, Occupancy, Budget, Accessibility
 * 5. Scorers: Feedback (25%), Preference (25%), Value (20%), Collaborative (15%), Diversity (10%), Upgrade (5%)
 * 6. Selection: TopKScore
 * 7. Side Effects: Recommendation interaction tracking (async)
 */
export function buildRecommendationPipeline(logger: PinoLogger) {
  return (
    new PipelineBuilder<RoomRecommendationQuery, RoomCandidate>(logger)
      // Query Hydrators - enrich query with guest context
      .addQueryHydrators([new GuestHistoryHydrator(), new GuestPreferencesHydrator()])

      // Sources - fetch candidates from multiple sources
      .addSources([
        new AvailableRoomsSource(),
        new SimilarRoomsSource(),
        new UpgradeOpportunitySource(),
      ])

      // Hydrators - enrich candidates with additional data (Feedback must run after RoomDetails)
      .addHydrators([
        new RoomDetailsHydrator(),
        new AmenityHydrator(),
        new PricingHydrator(),
        new FeedbackHydrator(),
      ])

      // Filters - remove ineligible candidates
      .addFilters([
        createDuplicateFilter(),
        new MaintenanceFilter(),
        new OccupancyFilter(),
        new BudgetFilter(),
        new AccessibilityFilter(),
      ])

      // Scorers — feedback-informed weights (total = 1.0)
      // Feedback:       25% — real guest satisfaction data
      // Preference:     25% — guest history & preference matching
      // Value:          20% — price optimization
      // Collaborative:  15% — "guests like you" signal
      // Diversity:      10% — variety in results
      // Upgrade:         5% — upsell opportunity
      .addScorers([
        new FeedbackScorer(), // 0.25 — guest ratings, sentiment, conversion
        new PreferenceScorer(), // 0.25 — booking history, amenity match
        new ValueScorer(), // 0.20 — price-to-value ratio
        new CollaborativeScorer(), // 0.15 — similar guest preferences
        new DiversityScorer(), // 0.10 — result variety
        new UpgradeScorer(), // 0.05 — upgrade opportunities
      ])

      // Selector - sort and select top K
      .setSelector(new TopKScoreSelector(config.recommendation.defaultResultSize))

      // Side effects — async tracking for the feedback loop
      .addSideEffects([new RecommendationTrackingSideEffect()])

      // Configuration
      .setResultSize(config.recommendation.maxResultSize)
      .setFailOpen(true)
      .build()
  );
}
