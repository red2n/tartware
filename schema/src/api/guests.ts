/**
 * DEV DOC
 * Module: api/guests.ts
 * Purpose: Guest API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

/**
 * Guest preference list item schema for API responses.
 */
export const GuestPreferenceListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	guest_id: uuid,
	preference_category: z.string(),
	preference_category_display: z.string(),
	preference_type: z.string(),
	preference_value: z.string().optional(),
	preference_code: z.string().optional(),
	priority: z.number().int(),
	is_mandatory: z.boolean(),
	is_special_request: z.boolean(),
	// Room preferences
	preferred_floor: z.number().int().optional(),
	floor_preference: z.string().optional(),
	bed_type_preference: z.string().optional(),
	smoking_preference: z.string().optional(),
	view_preference: z.string().optional(),
	room_location_preference: z.string().optional(),
	// Service preferences
	turndown_service: z.boolean().optional(),
	do_not_disturb_default: z.boolean().optional(),
	// Dietary
	dietary_restrictions: z.array(z.string()).optional(),
	food_allergies: z.array(z.string()).optional(),
	// Accessibility
	mobility_accessible: z.boolean().optional(),
	hearing_accessible: z.boolean().optional(),
	visual_accessible: z.boolean().optional(),
	service_animal: z.boolean().optional(),
	accessibility_notes: z.string().optional(),
	// Communication
	preferred_language: z.string().optional(),
	preferred_contact_method: z.string().optional(),
	marketing_opt_in: z.boolean().optional(),
	// Status
	is_active: z.boolean(),
	source: z.string().optional(),
	times_honored: z.number().int().optional(),
	notes: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
});

export type GuestPreferenceListItem = z.infer<
	typeof GuestPreferenceListItemSchema
>;

/**
 * Guest document list item schema for API responses.
 */
export const GuestDocumentListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	guest_id: uuid,
	reservation_id: uuid.optional(),
	document_type: z.string(),
	document_type_display: z.string(),
	document_category: z.string().optional(),
	document_number: z.string().optional(),
	document_name: z.string(),
	description: z.string().optional(),
	file_name: z.string(),
	file_size_bytes: z.number().optional(),
	file_type: z.string().optional(),
	mime_type: z.string().optional(),
	issue_date: z.string().optional(),
	expiry_date: z.string().optional(),
	issuing_country: z.string().optional(),
	is_verified: z.boolean(),
	verification_status: z.string(),
	verification_status_display: z.string(),
	verified_at: z.string().optional(),
	uploaded_at: z.string(),
	upload_source: z.string().optional(),
	is_expired: z.boolean(),
	days_until_expiry: z.number().int().optional(),
	created_at: z.string(),
});

export type GuestDocumentListItem = z.infer<typeof GuestDocumentListItemSchema>;

/**
 * Guest communication list item schema for API responses.
 */
export const GuestCommunicationListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	guest_id: uuid,
	reservation_id: uuid.optional(),
	communication_type: z.string(),
	communication_type_display: z.string(),
	direction: z.string(),
	direction_display: z.string(),
	subject: z.string().optional(),
	message: z.string(),
	sender_name: z.string().optional(),
	sender_email: z.string().optional(),
	recipient_name: z.string().optional(),
	recipient_email: z.string().optional(),
	status: z.string(),
	status_display: z.string(),
	sent_at: z.string().optional(),
	delivered_at: z.string().optional(),
	opened_at: z.string().optional(),
	failed_at: z.string().optional(),
	failure_reason: z.string().optional(),
	created_at: z.string(),
});

export type GuestCommunicationListItem = z.infer<
	typeof GuestCommunicationListItemSchema
>;

// =====================================================
// PRIVACY & CCPA
// =====================================================

/** Body schema for toggling the CCPA opt-out-of-sale flag. */
export const CcpaOptOutBodySchema = z.object({
	tenant_id: uuid,
	opt_out: z.boolean(),
});

export type CcpaOptOutBody = z.infer<typeof CcpaOptOutBodySchema>;

/** Body schema for updating channel communication preferences. */
export const CommunicationPrefsBodySchema = z.object({
	tenant_id: uuid,
	preferences: z.record(z.string(), z.boolean()),
});

export type CommunicationPrefsBody = z.infer<
	typeof CommunicationPrefsBodySchema
>;
