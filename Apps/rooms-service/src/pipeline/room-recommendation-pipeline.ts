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
import { AmenityHydrator, PricingHydrator, RoomDetailsHydrator } from "../hydrators/index.js";
import { GuestHistoryHydrator, GuestPreferencesHydrator } from "../query-hydrators/index.js";
import { DiversityScorer, PreferenceScorer, UpgradeScorer, ValueScorer } from "../scorers/index.js";
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
 * 3. Hydration: RoomDetails, Amenity, Pricing
 * 4. Filters: Duplicate, Maintenance, Occupancy, Budget, Accessibility
 * 5. Scorers: Preference, Value, Diversity, Upgrade
 * 6. Selection: TopKScore
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

      // Hydrators - enrich candidates with additional data
      .addHydrators([new RoomDetailsHydrator(), new AmenityHydrator(), new PricingHydrator()])

      // Filters - remove ineligible candidates
      .addFilters([
        createDuplicateFilter(),
        new MaintenanceFilter(),
        new OccupancyFilter(),
        new BudgetFilter(),
        new AccessibilityFilter(),
      ])

      // Scorers - compute relevance scores
      .addScorers([
        new PreferenceScorer(),
        new ValueScorer(),
        new DiversityScorer(),
        new UpgradeScorer(),
      ])

      // Selector - sort and select top K
      .setSelector(new TopKScoreSelector(config.recommendation.defaultResultSize))

      // Configuration
      .setResultSize(config.recommendation.maxResultSize)
      .setFailOpen(true)
      .build()
  );
}
