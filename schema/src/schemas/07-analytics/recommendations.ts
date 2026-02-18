/**
 * DEV DOC
 * Module: schemas/07-analytics/recommendations.ts
 * Description: Room Recommendation Schema - ML-powered room recommendations
 * Table: n/a (API schemas)
 * Category: 07-analytics
 * Primary exports: RoomRecommendationQuerySchema, RoomRecommendationSchema, RoomRecommendationResponseSchema
 * @table n/a
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * Room Recommendation Schema - ML-powered room recommendations
 * Based on X's recommendation system architecture
 * @category 07-analytics
 * @synchronized 2026-02-04
 */

import { z } from "zod";

import { isoDateString, uuid } from "../../shared/base-schemas.js";

/**
 * Guest booking history for personalization
 */
export const GuestBookingHistorySchema = z.object({
	totalBookings: z
		.number()
		.int()
		.nonnegative()
		.describe("Total number of past bookings"),
	previousRoomTypes: z
		.array(z.string())
		.describe("Room types previously booked"),
	previousProperties: z
		.array(z.string())
		.describe("Properties previously stayed at"),
	averageRate: z.number().nonnegative().describe("Average nightly rate paid"),
	preferredAmenities: z
		.array(z.string())
		.describe("Frequently requested amenities"),
});

export type GuestBookingHistory = z.infer<typeof GuestBookingHistorySchema>;

/**
 * Guest preferences for filtering and scoring (recommendation-specific)
 */
export const RecommendationGuestPreferencesSchema = z.object({
	preferredRoomTypes: z
		.array(z.string())
		.optional()
		.describe("Preferred room types"),
	floorPreference: z
		.enum(["high", "low", "any"])
		.optional()
		.describe("Preferred floor"),
	viewPreferences: z
		.array(z.string())
		.optional()
		.describe("Preferred view types"),
	accessibilityNeeds: z
		.array(z.string())
		.optional()
		.describe("Accessibility requirements"),
	quietRoom: z.boolean().optional().describe("Do not disturb preferences"),
});

export type RecommendationGuestPreferences = z.infer<
	typeof RecommendationGuestPreferencesSchema
>;

/**
 * Room recommendation query parameters
 */
export const RoomRecommendationQuerySchema = z.object({
	propertyId: uuid.describe("Property ID to search within"),
	guestId: uuid.optional().describe("Guest ID for personalization"),
	checkInDate: isoDateString.describe("Check-in date (YYYY-MM-DD)"),
	checkOutDate: isoDateString.describe("Check-out date (YYYY-MM-DD)"),
	adults: z
		.number()
		.int()
		.min(1)
		.max(10)
		.default(1)
		.describe("Number of adults"),
	children: z
		.number()
		.int()
		.min(0)
		.max(10)
		.default(0)
		.describe("Number of children"),
	limit: z
		.number()
		.int()
		.min(1)
		.max(50)
		.optional()
		.describe("Maximum results to return"),
});

export type RoomRecommendationQuery = z.infer<
	typeof RoomRecommendationQuerySchema
>;

/**
 * A single room recommendation
 */
export const RoomRecommendationSchema = z.object({
	roomId: uuid.describe("Room ID"),
	roomTypeId: uuid.describe("Room type ID"),
	roomTypeName: z.string().describe("Room type name"),
	roomNumber: z.string().describe("Room number"),
	floor: z.union([z.string(), z.number().int()]).describe("Floor label"),
	viewType: z.string().optional().describe("View type"),
	baseRate: z.number().nonnegative().describe("Base rate per night"),
	dynamicRate: z
		.number()
		.nonnegative()
		.optional()
		.describe("Dynamic rate for the dates"),
	totalPrice: z
		.number()
		.nonnegative()
		.optional()
		.describe("Total price for the stay"),
	amenities: z.array(z.string()).optional().describe("Room amenities"),
	description: z.string().optional().describe("Room description"),
	photos: z.array(z.string()).optional().describe("Room photo URLs"),
	maxOccupancy: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Maximum occupancy"),
	bedType: z.string().optional().describe("Bed type"),
	squareFootage: z.number().positive().optional().describe("Square footage"),
	isUpgrade: z
		.boolean()
		.optional()
		.describe("Whether this is an upgrade opportunity"),
	upgradeDiscount: z
		.number()
		.min(0)
		.max(100)
		.optional()
		.describe("Upgrade discount percentage"),
	relevanceScore: z
		.number()
		.min(0)
		.max(1)
		.describe("Relevance score (0-1, higher is better)"),
	source: z
		.enum(["available_rooms", "similar_rooms", "upgrade_opportunity"])
		.describe("Candidate source"),
});

export type RoomRecommendation = z.infer<typeof RoomRecommendationSchema>;

/**
 * Room recommendation response
 */
export const RoomRecommendationResponseSchema = z.object({
	requestId: uuid.describe("Request ID for tracing"),
	recommendations: z
		.array(RoomRecommendationSchema)
		.describe("Recommended rooms"),
	totalCandidates: z
		.number()
		.int()
		.nonnegative()
		.describe("Total candidates considered"),
	executionTimeMs: z
		.number()
		.nonnegative()
		.describe("Pipeline execution time in ms"),
});

export type RoomRecommendationResponse = z.infer<
	typeof RoomRecommendationResponseSchema
>;

/**
 * Pipeline metrics for observability
 */
export const RecommendationPipelineMetricsSchema = z.object({
	totalDurationMs: z
		.number()
		.nonnegative()
		.describe("Total execution time in ms"),
	stageDurations: z
		.record(z.string(), z.number())
		.describe("Time spent in each stage"),
	candidateCounts: z.object({
		sourced: z.number().int().nonnegative().describe("Candidates from sources"),
		afterHydration: z
			.number()
			.int()
			.nonnegative()
			.describe("Candidates after hydration"),
		afterFiltering: z
			.number()
			.int()
			.nonnegative()
			.describe("Candidates after filtering"),
		selected: z
			.number()
			.int()
			.nonnegative()
			.describe("Final selected candidates"),
	}),
	componentMetrics: z.array(
		z.object({
			stage: z.string().describe("Pipeline stage name"),
			name: z.string().describe("Component name"),
			durationMs: z.number().nonnegative().describe("Component duration in ms"),
			success: z.boolean().describe("Whether component succeeded"),
			error: z.string().optional().describe("Error message if failed"),
		}),
	),
});

export type RecommendationPipelineMetrics = z.infer<
	typeof RecommendationPipelineMetricsSchema
>;
