/**
 * MobileCheckIns Schema
 * @table mobile_check_ins
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete MobileCheckIns schema
 */
export const MobileCheckInsSchema = z.object({
	mobile_checkin_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	reservation_id: uuid,
	guest_id: uuid,
	checkin_status: z.string().optional(),
	checkin_started_at: z.coerce.date().optional(),
	checkin_completed_at: z.coerce.date().optional(),
	time_to_complete_seconds: z.number().int().optional(),
	access_method: z.string().optional(),
	device_type: z.string().optional(),
	device_model: z.string().optional(),
	app_version: z.string().optional(),
	browser: z.string().optional(),
	operating_system: z.string().optional(),
	checkin_location: z.string().optional(),
	ip_address: z.string().optional(),
	geolocation: z.record(z.unknown()).optional(),
	identity_verification_method: z.string().optional(),
	id_document_type: z.string().optional(),
	id_document_uploaded: z.boolean().optional(),
	id_document_verified: z.boolean().optional(),
	id_verified_at: z.coerce.date().optional(),
	id_verified_by: uuid.optional(),
	face_match_score: money.optional(),
	liveness_check_passed: z.boolean().optional(),
	registration_card_signed: z.boolean().optional(),
	signature_captured: z.boolean().optional(),
	signature_url: z.string().optional(),
	registration_card_url: z.string().optional(),
	terms_accepted: z.boolean().optional(),
	terms_accepted_at: z.coerce.date().optional(),
	payment_method_verified: z.boolean().optional(),
	payment_authorization_code: z.string().optional(),
	deposit_collected: z.boolean().optional(),
	deposit_amount: money.optional(),
	room_preference_submitted: z.boolean().optional(),
	preferred_floor: z.number().int().optional(),
	preferred_view: z.string().optional(),
	preferred_bed_type: z.string().optional(),
	accessibility_requirements: z.array(z.string()).optional(),
	room_id: uuid.optional(),
	room_assigned: z.boolean().optional(),
	room_assigned_at: z.coerce.date().optional(),
	room_assignment_method: z.string().optional(),
	upgrade_offered: z.boolean().optional(),
	upgrade_accepted: z.boolean().optional(),
	upgrade_amount: money.optional(),
	digital_key_type: z.string().optional(),
	digital_key_generated: z.boolean().optional(),
	digital_key_id: z.string().optional(),
	digital_key_expires_at: z.coerce.date().optional(),
	key_delivery_method: z.string().optional(),
	early_checkin_requested: z.boolean().optional(),
	early_checkin_approved: z.boolean().optional(),
	requested_checkin_time: z.string().optional(),
	special_requests: z.string().optional(),
	dietary_restrictions: z.string().optional(),
	upsells_presented: z.record(z.unknown()).optional(),
	upsells_accepted: z.record(z.unknown()).optional(),
	total_upsell_revenue: money.optional(),
	sms_notifications_enabled: z.boolean().optional(),
	email_notifications_enabled: z.boolean().optional(),
	push_notifications_enabled: z.boolean().optional(),
	preferred_language: z.string().optional(),
	arrival_instructions_viewed: z.boolean().optional(),
	property_map_viewed: z.boolean().optional(),
	amenities_guide_viewed: z.boolean().optional(),
	chatbot_interaction_count: z.number().int().optional(),
	help_requested: z.boolean().optional(),
	checkin_rating: z.number().int().optional(),
	checkin_feedback: z.string().optional(),
	nps_score: z.number().int().optional(),
	requires_staff_assistance: z.boolean().optional(),
	staff_notified: z.boolean().optional(),
	staff_assisted_by: uuid.optional(),
	staff_notes: z.string().optional(),
	error_count: z.number().int().optional(),
	last_error_message: z.string().optional(),
	last_error_at: z.coerce.date().optional(),
	checkin_confirmation_sent: z.boolean().optional(),
	confirmation_sent_at: z.coerce.date().optional(),
	welcome_message_sent: z.boolean().optional(),
	welcome_message_viewed: z.boolean().optional(),
	session_id: z.string().optional(),
	utm_source: z.string().optional(),
	utm_medium: z.string().optional(),
	utm_campaign: z.string().optional(),
	referrer: z.string().optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type MobileCheckIns = z.infer<typeof MobileCheckInsSchema>;

/**
 * Schema for creating a new mobile check ins
 */
export const CreateMobileCheckInsSchema = MobileCheckInsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateMobileCheckIns = z.infer<typeof CreateMobileCheckInsSchema>;

/**
 * Schema for updating a mobile check ins
 */
export const UpdateMobileCheckInsSchema = MobileCheckInsSchema.partial();

export type UpdateMobileCheckIns = z.infer<typeof UpdateMobileCheckInsSchema>;
