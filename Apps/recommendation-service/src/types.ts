/**
 * Types for the recommendation service.
 *
 * Defines the query and candidate types that flow through the pipeline.
 * RoomRecommendationQuery is the extended pipeline query (with requestId, tenant context, and hydrated fields).
 * GuestPreferences is the recommendation-specific guest preferences type.
 */

export type {
  GuestBookingHistory,
  RecommendationGuestPreferences as GuestPreferences,
  RoomCandidate,
  RoomRecommendation,
  RoomRecommendationPipelineQuery as RoomRecommendationQuery,
  RoomRecommendationResponse,
} from "@tartware/schemas";
