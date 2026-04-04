/**
 * DEV DOC
 * Module: api/recommendations.ts
 * Purpose: Recommendation engine API schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import {
	GuestBookingHistorySchema,
	RecommendationGuestPreferencesSchema,
} from "../schemas/07-analytics/recommendations.js";
import { uuid } from "../shared/base-schemas.js";

// -----------------------------------------------------------------------------
// Query
// -----------------------------------------------------------------------------

/** Query schema for getting room recommendations. */
export const RecommendationQuerySchema = z.object({
	propertyId: uuid,
	guestId: uuid.optional(),
	checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	adults: z.coerce.number().int().min(1).max(10).default(1),
	children: z.coerce.number().int().min(0).max(10).default(0),
	limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;

// -----------------------------------------------------------------------------
// Rank Rooms
// -----------------------------------------------------------------------------

/** Body schema for ranking a list of room IDs. */
export const RankRoomsBodySchema = z.object({
	propertyId: uuid,
	guestId: uuid.optional(),
	checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	adults: z.number().int().min(1).max(10).default(1),
	children: z.number().int().min(0).max(10).default(0),
	roomIds: z.array(uuid).min(1).max(100),
});

export type RankRoomsBody = z.infer<typeof RankRoomsBodySchema>;

// =====================================================
// RECOMMENDATION SERVICE DOMAIN TYPES
// =====================================================

// =====================================================
// RECOMMENDATION PIPELINE TYPES (service-layer)
// =====================================================

/** Recommendation-specific guest preferences for pipeline filtering/scoring. */
export type { RecommendationGuestPreferences } from "../schemas/07-analytics/recommendations.js";

/**
 * Extended recommendation pipeline query — enriched with tenant context and hydrated fields.
 *
 * Structurally satisfies HasRequestId from @tartware/candidate-pipeline.
 */
export interface RoomRecommendationPipelineQuery {
	/** Unique request identifier for tracing */
	requestId: string;
	/** Tenant ID for multi-tenancy */
	tenantId: string;
	/** Property ID to search within */
	propertyId: string;
	/** Guest ID for personalization (optional for anonymous users) */
	guestId?: string;
	/** Check-in date */
	checkInDate: string;
	/** Check-out date */
	checkOutDate: string;
	/** Number of adults */
	adults: number;
	/** Number of children */
	children: number;
	/** Maximum number of results to return */
	limit: number;
	/** Guest's booking history (populated by GuestHistoryHydrator) */
	guestHistory?: z.infer<typeof GuestBookingHistorySchema>;
	/** Guest's preferences (populated by GuestPreferencesHydrator) */
	guestPreferences?: z.infer<typeof RecommendationGuestPreferencesSchema>;
	/** Guest's loyalty tier (populated by GuestFeaturesHydrator) */
	loyaltyTier?: string;
	/** Guest's budget range (populated by GuestFeaturesHydrator) */
	budgetRange?: { min: number; max: number };
}

// =====================================================
// ROOM FEEDBACK STATS (populated by FeedbackHydrator)
// =====================================================

/**
 * Aggregate feedback statistics for a room or room type.
 * Populated by FeedbackHydrator from the guest_feedback table.
 */
export interface RoomFeedbackStats {
	/** Average overall rating (1-5 scale) */
	avgRating: number;
	/** Total number of reviews */
	reviewCount: number;
	/** Percentage of guests who said would_return (0-1) */
	wouldReturnRate: number;
	/** Average sentiment score (-1 to 1) */
	avgSentiment: number;
	/** Sub-dimension averages */
	avgCleanliness: number;
	avgComfort: number;
	avgValue: number;
	avgAmenities: number;
	/** Conversion rate: booked / shown from recommendation_interactions (0-1) */
	conversionRate: number;
}

/**
 * Room candidate — item flowing through the recommendation pipeline.
 *
 * Structurally satisfies HasScore from @tartware/candidate-pipeline.
 */
export interface RoomCandidate {
	/** Room ID */
	roomId: string;
	/** Room type ID */
	roomTypeId: string;
	/** Room type name */
	roomTypeName: string;
	/** Room number */
	roomNumber: string;
	/** Floor (string from DB, may be "10", "Lobby", etc.) */
	floor: number | string;
	/** View type */
	viewType?: string;
	/** Base rate per night */
	baseRate: number;
	/** Room status */
	status: string;
	/** Source that provided this candidate */
	source: "available_rooms" | "similar_rooms" | "upgrade_opportunity";
	/** Room amenities (populated by RoomDetailsHydrator) */
	amenities?: string[];
	/** Room description (populated by RoomDetailsHydrator) */
	description?: string;
	/** Room photos (populated by PhotoHydrator) */
	photos?: string[];
	/** Maximum occupancy (populated by RoomDetailsHydrator) */
	maxOccupancy?: number;
	/** Bed type (populated by RoomDetailsHydrator) */
	bedType?: string;
	/** Square footage (populated by RoomDetailsHydrator) */
	squareFootage?: number;
	/** Dynamic rate for the dates (populated by PricingHydrator) */
	dynamicRate?: number;
	/** Total price for the stay (populated by PricingHydrator) */
	totalPrice?: number;
	/** Whether this is an upgrade opportunity */
	isUpgrade?: boolean;
	/** Upgrade discount percentage */
	upgradeDiscount?: number;
	/** Aggregate guest feedback stats (populated by FeedbackHydrator) */
	feedbackStats?: RoomFeedbackStats;
	/** Cumulative score (used for ranking) */
	score?: number;
	/** Individual scores from each scorer */
	scores?: Record<string, number>;
}
