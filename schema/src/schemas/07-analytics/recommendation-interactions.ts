/**
 * DEV DOC
 * Module: schemas/07-analytics/recommendation-interactions.ts
 * Description: RecommendationInteractions Schema — closed-loop tracking
 *   of recommendation→view→book→review for ML feedback loop
 * Table: recommendation_interactions
 * Category: 07-analytics
 * Primary exports: RecommendationInteractionsSchema, CreateRecommendationInteractionsSchema, UpdateRecommendationInteractionsSchema
 * @table recommendation_interactions
 * @category 07-analytics
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

// ─── Constrained enums ───────────────────────────────────────────────────────

const interactionType = z.enum([
	"shown",
	"viewed",
	"selected",
	"booked",
	"rejected",
	"dismissed",
]);

const deviceType = z.enum(["desktop", "mobile", "tablet", "api"]);

const channel = z.enum(["pms_ui", "guest_portal", "api", "ota"]);

const candidateSource = z.enum([
	"available_rooms",
	"similar_rooms",
	"upgrade_opportunity",
]);

// ─── Full Row Schema ─────────────────────────────────────────────────────────

export const RecommendationInteractionsSchema = z.object({
	interaction_id: uuid,
	tenant_id: uuid,
	property_id: uuid,

	// Recommendation context
	recommendation_request_id: uuid,
	guest_id: uuid.optional().nullable(),
	room_id: uuid,
	room_type_id: uuid,

	// Interaction
	interaction_type: interactionType.default("shown"),
	position_shown: z.number().int().min(1).max(200),
	relevance_score_at_time: z.number().min(0).max(1).optional().nullable(),

	// Conversion
	booked: z.boolean().default(false),
	reservation_id: uuid.optional().nullable(),
	booking_delay_minutes: z.number().int().optional().nullable(),

	// Post-stay feedback
	post_stay_rating: z.number().min(0).max(5).optional().nullable(),
	post_stay_would_return: z.boolean().optional().nullable(),
	feedback_id: uuid.optional().nullable(),

	// Pipeline metadata
	pipeline_execution_ms: z.number().optional().nullable(),
	scoring_breakdown: z.record(z.number()).optional().nullable(),
	source: candidateSource.optional().nullable(),

	// Session context
	session_id: uuid.optional().nullable(),
	device_type: deviceType.optional().nullable(),
	channel: channel.optional().nullable(),

	// Audit
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
});

export type RecommendationInteractions = z.infer<
	typeof RecommendationInteractionsSchema
>;

// ─── Create Schema ───────────────────────────────────────────────────────────

export const CreateRecommendationInteractionsSchema =
	RecommendationInteractionsSchema.omit({
		interaction_id: true,
		created_at: true,
		updated_at: true,
		post_stay_rating: true,
		post_stay_would_return: true,
		feedback_id: true,
		booking_delay_minutes: true,
	});

export type CreateRecommendationInteractions = z.infer<
	typeof CreateRecommendationInteractionsSchema
>;

// ─── Update Schema ───────────────────────────────────────────────────────────

export const UpdateRecommendationInteractionsSchema =
	RecommendationInteractionsSchema.partial().omit({
		interaction_id: true,
		tenant_id: true,
		recommendation_request_id: true,
		created_at: true,
	});

export type UpdateRecommendationInteractions = z.infer<
	typeof UpdateRecommendationInteractionsSchema
>;
