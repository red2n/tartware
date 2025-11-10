/**
 * GuestJourneyTracking Schema
 * @table guest_journey_tracking
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete GuestJourneyTracking schema
 */
export const GuestJourneyTrackingSchema = z.object({
	journey_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	guest_id: uuid,
	guest_segment: z.string().optional(),
	journey_type: z.string().optional(),
	journey_status: z.string().optional(),
	journey_start_date: z.coerce.date(),
	journey_end_date: z.coerce.date().optional(),
	journey_duration_minutes: z.number().int().optional(),
	touchpoint_count: z.number().int().optional(),
	touchpoints: z.record(z.unknown()).optional(),
	channels_used: z.array(z.string()).optional(),
	primary_channel: z.string().optional(),
	stages_completed: z.array(z.string()).optional(),
	current_stage: z.string().optional(),
	converted: z.boolean().optional(),
	conversion_date: z.coerce.date().optional(),
	conversion_value: money.optional(),
	total_interactions: z.number().int().optional(),
	website_visits: z.number().int().optional(),
	email_opens: z.number().int().optional(),
	email_clicks: z.number().int().optional(),
	app_sessions: z.number().int().optional(),
	phone_calls: z.number().int().optional(),
	in_person_visits: z.number().int().optional(),
	engagement_score: money.optional(),
	satisfaction_score: money.optional(),
	nps_score: z.number().int().optional(),
	sentiment: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type GuestJourneyTracking = z.infer<typeof GuestJourneyTrackingSchema>;

/**
 * Schema for creating a new guest journey tracking
 */
export const CreateGuestJourneyTrackingSchema = GuestJourneyTrackingSchema.omit(
	{
		// TODO: Add fields to omit for creation
	},
);

export type CreateGuestJourneyTracking = z.infer<
	typeof CreateGuestJourneyTrackingSchema
>;

/**
 * Schema for updating a guest journey tracking
 */
export const UpdateGuestJourneyTrackingSchema =
	GuestJourneyTrackingSchema.partial();

export type UpdateGuestJourneyTracking = z.infer<
	typeof UpdateGuestJourneyTrackingSchema
>;
