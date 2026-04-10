/**
 * DEV DOC
 * Module: api/guest-rows.ts
 * Purpose: Raw PostgreSQL row shapes for guests-service query results.
 * Ownership: Schema package
 */

import type { GuestRegisterCommand } from "../events/commands/guests.js";

// =====================================================
// GUEST ROW (full profile query)
// =====================================================

/** Raw row shape from guests table with all profile fields. */
export type GuestProfileRow = {
	id: string;
	tenant_id: string;
	first_name: string;
	last_name: string;
	middle_name: string | null;
	title: string | null;
	date_of_birth: Date | null;
	gender: string | null;
	nationality: string | null;
	email: string;
	phone: string | null;
	secondary_phone: string | null;
	address: Record<string, unknown> | null;
	id_type: string | null;
	id_number: string | null;
	passport_number: string | null;
	passport_expiry: Date | null;
	company_name: string | null;
	company_tax_id: string | null;
	loyalty_tier: string | null;
	loyalty_points: number | null;
	vip_status: string | null;
	preferences: Record<string, unknown> | null;
	marketing_consent: boolean | null;
	communication_preferences: Record<string, unknown> | null;
	total_bookings: number | null;
	total_nights: number | null;
	total_revenue: string | number | null;
	last_stay_date: Date | null;
	member_since: Date;
	first_stay_date: Date | null;
	is_blacklisted: boolean | null;
	blacklist_reason: string | null;
	notes: string | null;
	metadata: Record<string, unknown> | null;
	created_at: Date;
	updated_at: Date | null;
	created_by: string | null;
	updated_by: string | null;
	deleted_at: Date | null;
	version: bigint | null;
};

/** Raw row shape for lightweight guest grid queries. */
export type GuestGridRow = {
	id: string;
	first_name: string;
	last_name: string;
	title: string | null;
	nationality: string | null;
	email: string;
	phone: string | null;
	company_name: string | null;
	loyalty_tier: string | null;
	vip_status: string | null;
	total_bookings: number | null;
	total_revenue: string | number | null;
	last_stay_date: Date | null;
	member_since: Date;
	is_blacklisted: boolean | null;
};

// =====================================================
// GUEST ROW (command-service merge variant)
// =====================================================

/** Smaller guest row subset used in merge/update command processing. */
export type GuestCommandRow = {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	phone: string | null;
	secondary_phone: string | null;
	address: Record<string, unknown> | null;
	preferences: Record<string, unknown> | null;
	notes: string | null;
	metadata: Record<string, unknown> | null;
	total_bookings: number | null;
	total_nights: number | null;
	total_revenue: number | string | null;
	last_stay_date: string | Date | null;
	loyalty_points: number | null;
	loyalty_tier: string | null;
	vip_status: string | null;
	is_blacklisted: boolean | null;
};

// =====================================================
// GUEST RESERVATION STATS
// =====================================================

/** Computed guest reservation statistics. */
export type GuestReservationStats = {
	upcomingReservations: number;
	pastReservations: number;
	cancelledReservations: number;
	averageStayLength?: number;
	preferredRoomTypes?: string[];
	lifetimeValue?: number;
};

// =====================================================
// GUEST ADDRESS
// =====================================================

/** Guest address sub-shape for command payloads. */
export type GuestAddress = {
	street?: string;
	city?: string;
	state?: string;
	country?: string;
	postal_code?: string;
};

// =====================================================
// GUEST MERGE RESULT
// =====================================================

/** Result of a guest profile merge operation. */
export type GuestMergeResult = {
	primaryGuestId: string;
};

// =====================================================
// GUEST PREFERENCE ROW
// =====================================================

/** Raw row shape from guest_preferences table query. */
export type GuestPreferenceRow = {
	id: string;
	tenant_id: string;
	property_id: string | null;
	guest_id: string;
	preference_category: string;
	preference_type: string;
	preference_value: string | null;
	preference_code: string | null;
	priority: number;
	is_mandatory: boolean;
	is_special_request: boolean;
	preferred_floor: number | null;
	floor_preference: string | null;
	bed_type_preference: string | null;
	smoking_preference: string | null;
	view_preference: string | null;
	room_location_preference: string | null;
	turndown_service: boolean | null;
	do_not_disturb_default: boolean | null;
	dietary_restrictions: string[] | null;
	food_allergies: string[] | null;
	mobility_accessible: boolean | null;
	hearing_accessible: boolean | null;
	visual_accessible: boolean | null;
	service_animal: boolean | null;
	accessibility_notes: string | null;
	preferred_language: string | null;
	preferred_contact_method: string | null;
	marketing_opt_in: boolean | null;
	is_active: boolean;
	source: string | null;
	times_honored: number | null;
	notes: string | null;
	created_at: Date;
	updated_at: Date | null;
};

// =====================================================
// GUEST DOCUMENT ROW
// =====================================================

/** Raw row shape from guest_documents table query. */
export type GuestDocumentRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	guest_id: string;
	reservation_id: string | null;
	document_type: string;
	document_category: string | null;
	document_number: string | null;
	document_name: string;
	description: string | null;
	file_name: string;
	file_size_bytes: number | null;
	file_type: string | null;
	mime_type: string | null;
	issue_date: Date | null;
	expiry_date: Date | null;
	issuing_country: string | null;
	is_verified: boolean;
	verification_status: string;
	verified_at: Date | null;
	uploaded_at: Date;
	upload_source: string | null;
	is_expired: boolean;
	days_until_expiry: number | null;
	created_at: Date;
};

// =====================================================
// GUEST COMMUNICATION ROW
// =====================================================

/** Raw row shape from guest_communications table query. */
export type GuestCommunicationRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	guest_id: string;
	reservation_id: string | null;
	communication_type: string;
	direction: string;
	subject: string | null;
	message: string;
	sender_name: string | null;
	sender_email: string | null;
	recipient_name: string | null;
	recipient_email: string | null;
	status: string;
	sent_at: Date | null;
	delivered_at: Date | null;
	opened_at: Date | null;
	failed_at: Date | null;
	failure_reason: string | null;
	created_at: Date;
};

// =====================================================
// COMMAND HANDLER OPTIONS
// =====================================================

/** Common initiator shape for command handler options. */
export type CommandInitiator = {
	userId?: string;
	role?: string;
};

/** Options for the guest.register command handler. */
export type RegisterGuestOptions = {
	tenantId: string;
	payload: GuestRegisterCommand;
	correlationId?: string;
	initiatedBy?: CommandInitiator | null;
};

/** Options for the guest.merge command handler. */
export type MergeGuestOptions = {
	tenantId: string;
	payload: unknown;
	correlationId?: string;
	initiatedBy?: CommandInitiator | null;
};

/** Options for the guest.update command handler. */
export type GuestUpdateOptions = {
	tenantId: string;
	payload: unknown;
	correlationId?: string;
	initiatedBy?: CommandInitiator | null;
};
