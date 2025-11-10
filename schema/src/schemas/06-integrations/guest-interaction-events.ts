/**
 * GuestInteractionEvents Schema
 * @table guest_interaction_events
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete GuestInteractionEvents schema
 */
export const GuestInteractionEventsSchema = z.object({
	event_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	guest_id: uuid,
	reservation_id: uuid.optional(),
	event_type: z.string(),
	event_timestamp: z.coerce.date().optional(),
	event_source: z.string().optional(),
	session_id: z.string().optional(),
	device_type: z.string().optional(),
	browser: z.string().optional(),
	operating_system: z.string().optional(),
	page_url: z.string().optional(),
	referrer_url: z.string().optional(),
	utm_source: z.string().optional(),
	utm_medium: z.string().optional(),
	utm_campaign: z.string().optional(),
	event_data: z.record(z.unknown()).optional(),
	ip_address: z.string().optional(),
	country: z.string().optional(),
	city: z.string().optional(),
	time_spent_seconds: z.number().int().optional(),
	created_at: z.coerce.date().optional(),
});

export type GuestInteractionEvents = z.infer<
	typeof GuestInteractionEventsSchema
>;

/**
 * Schema for creating a new guest interaction events
 */
export const CreateGuestInteractionEventsSchema =
	GuestInteractionEventsSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateGuestInteractionEvents = z.infer<
	typeof CreateGuestInteractionEventsSchema
>;

/**
 * Schema for updating a guest interaction events
 */
export const UpdateGuestInteractionEventsSchema =
	GuestInteractionEventsSchema.partial();

export type UpdateGuestInteractionEvents = z.infer<
	typeof UpdateGuestInteractionEventsSchema
>;
