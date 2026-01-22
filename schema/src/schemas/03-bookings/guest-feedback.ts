/**
 * DEV DOC
 * Module: schemas/03-bookings/guest-feedback.ts
 * Description: GuestFeedback Schema
 * Table: guest_feedback
 * Category: 03-bookings
 * Primary exports: GuestFeedbackSchema, CreateGuestFeedbackSchema, UpdateGuestFeedbackSchema
 * @table guest_feedback
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * GuestFeedback Schema
 * @table guest_feedback
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete GuestFeedback schema
 */
export const GuestFeedbackSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	guest_id: uuid,
	reservation_id: uuid,
	feedback_source: z.string().optional(),
	overall_rating: money.optional(),
	rating_scale: z.number().int().optional(),
	cleanliness_rating: money.optional(),
	staff_rating: money.optional(),
	location_rating: money.optional(),
	value_rating: money.optional(),
	amenities_rating: money.optional(),
	comfort_rating: money.optional(),
	facilities_rating: money.optional(),
	review_title: z.string().optional(),
	review_text: z.string().optional(),
	positive_comments: z.string().optional(),
	negative_comments: z.string().optional(),
	suggestions: z.string().optional(),
	would_recommend: z.boolean().optional(),
	would_return: z.boolean().optional(),
	sentiment_score: money.optional(),
	sentiment_label: z.string().optional(),
	tags: z.record(z.unknown()).optional(),
	is_verified: z.boolean().optional(),
	is_public: z.boolean().optional(),
	is_featured: z.boolean().optional(),
	response_text: z.string().optional(),
	responded_by: uuid.optional(),
	responded_at: z.coerce.date().optional(),
	external_review_id: z.string().optional(),
	external_review_url: z.string().optional(),
	language_code: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
});

export type GuestFeedback = z.infer<typeof GuestFeedbackSchema>;

/**
 * Schema for creating a new guest feedback
 */
export const CreateGuestFeedbackSchema = GuestFeedbackSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateGuestFeedback = z.infer<typeof CreateGuestFeedbackSchema>;

/**
 * Schema for updating a guest feedback
 */
export const UpdateGuestFeedbackSchema = GuestFeedbackSchema.partial();

export type UpdateGuestFeedback = z.infer<typeof UpdateGuestFeedbackSchema>;
