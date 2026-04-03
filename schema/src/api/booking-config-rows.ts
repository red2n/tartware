/**
 * DEV DOC
 * Module: api/booking-config-rows.ts
 * Purpose: Raw PostgreSQL row shapes for booking configuration service queries —
 *          meeting rooms, event bookings, booking sources, market segments,
 *          channel mappings, companies, waitlist entries, group bookings, promo codes.
 * Ownership: Schema package
 */

// =====================================================
// ALLOTMENT ROW
// =====================================================

/** Raw row shape from allotments table query with joined property data. */
export type AllotmentRow = {
	allotment_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	allotment_code: string;
	allotment_name: string;
	allotment_type: string;
	allotment_status: string;
	start_date: string | Date;
	end_date: string | Date;
	cutoff_date: string | Date | null;
	room_type_id: string | null;
	total_rooms_blocked: number;
	total_room_nights: number | null;
	rooms_per_night: number | null;
	rooms_picked_up: number;
	rooms_available: number | null;
	pickup_percentage: number | string;
	rate_type: string | null;
	contracted_rate: number | string | null;
	total_expected_revenue: number | string | null;
	actual_revenue: number | string | null;
	currency_code: string;
	account_name: string | null;
	account_type: string | null;
	billing_type: string;
	contact_name: string | null;
	contact_email: string | null;
	deposit_required: boolean;
	attrition_clause: boolean;
	attrition_percentage: number | string | null;
	guaranteed_rooms: number | null;
	is_vip: boolean;
	priority_level: number;
	created_at: string | Date;
	updated_at: string | Date | null;
};

// =====================================================
// MEETING ROOM ROW
// =====================================================

/** Raw row shape from meeting_rooms table query with joined property data. */
export type MeetingRoomRow = {
	room_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	room_code: string;
	room_name: string;
	room_type: string;
	room_status: string;
	building: string | null;
	floor: number | null;
	location_description: string | null;
	max_capacity: number;
	theater_capacity: number | null;
	classroom_capacity: number | null;
	banquet_capacity: number | null;
	reception_capacity: number | null;
	u_shape_capacity: number | null;
	boardroom_capacity: number | null;
	area_sqm: number | string | null;
	area_sqft: number | string | null;
	length_meters: number | string | null;
	width_meters: number | string | null;
	ceiling_height_meters: number | string | null;
	has_natural_light: boolean;
	has_audio_visual: boolean;
	has_video_conferencing: boolean;
	has_wifi: boolean;
	has_stage: boolean;
	has_dance_floor: boolean;
	wheelchair_accessible: boolean;
	default_setup: string | null;
	setup_time_minutes: number;
	teardown_time_minutes: number;
	turnover_time_minutes: number;
	hourly_rate: number | string | null;
	half_day_rate: number | string | null;
	full_day_rate: number | string | null;
	minimum_rental_hours: number;
	currency_code: string;
	operating_hours_start: string | null;
	operating_hours_end: string | null;
	catering_required: boolean;
	in_house_catering_available: boolean;
	external_catering_allowed: boolean;
	primary_photo_url: string | null;
	floor_plan_url: string | null;
	virtual_tour_url: string | null;
	is_active: boolean;
	requires_approval: boolean;
	created_at: string | Date;
	updated_at: string | Date | null;
};

// =====================================================
// EVENT BOOKING ROW
// =====================================================

/** Raw row shape from event_bookings table query. */
export type EventBookingRow = {
	event_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	event_number: string | null;
	event_name: string;
	event_type: string;
	meeting_room_id: string;
	meeting_room_name: string | null;
	event_date: string | Date;
	start_time: string;
	end_time: string;
	setup_start_time: string | null;
	actual_start_time: string | null;
	actual_end_time: string | null;
	organizer_name: string;
	organizer_company: string | null;
	organizer_email: string | null;
	organizer_phone: string | null;
	guest_id: string | null;
	reservation_id: string | null;
	company_id: string | null;
	expected_attendees: number;
	confirmed_attendees: number | null;
	actual_attendees: number | null;
	guarantee_number: number | null;
	setup_type: string;
	catering_required: boolean;
	audio_visual_needed: boolean;
	booking_status: string;
	payment_status: string;
	booked_date: string | Date;
	confirmed_date: string | Date | null;
	beo_due_date: string | Date | null;
	final_count_due_date: string | Date | null;
	rental_rate: number | string | null;
	estimated_total: number | string | null;
	actual_total: number | string | null;
	deposit_required: number | string | null;
	deposit_paid: number | string | null;
	currency_code: string;
	contract_signed: boolean;
	beo_pdf_url: string | null;
	post_event_rating: number | null;
	attendee_satisfaction_score: number | string | null;
	is_recurring: boolean;
	followup_required: boolean;
	created_at: string | Date;
	updated_at: string | Date | null;
};

// =====================================================
// BOOKING SOURCE ROW
// =====================================================

/** Raw row shape from booking sources / channel stats query. */
export type BookingSourceRow = {
	source_id: string;
	tenant_id: string;
	property_id: string | null;
	property_name: string | null;
	source_code: string;
	source_name: string;
	source_type: string;
	category: string | null;
	is_active: boolean;
	is_bookable: boolean;
	channel_name: string | null;
	channel_website: string | null;
	commission_type: string;
	commission_percentage: number | string | null;
	commission_fixed_amount: number | string | null;
	total_bookings: number;
	total_revenue: number | string | null;
	total_room_nights: number;
	average_booking_value: number | string | null;
	conversion_rate: number | string | null;
	cancellation_rate: number | string | null;
	ranking: number | null;
	is_preferred: boolean;
	is_featured: boolean;
	has_integration: boolean;
	integration_type: string | null;
	last_sync_at: string | Date | null;
	display_name: string | null;
	logo_url: string | null;
	color_code: string | null;
};

// =====================================================
// MARKET SEGMENT ROW
// =====================================================

/** Raw row shape from market_segments table with analytics aggregates. */
export type MarketSegmentRow = {
	segment_id: string;
	tenant_id: string;
	property_id: string | null;
	property_name: string | null;
	segment_code: string;
	segment_name: string;
	segment_type: string;
	is_active: boolean;
	is_bookable: boolean;
	parent_segment_id: string | null;
	segment_level: number;
	average_daily_rate: number | string | null;
	average_length_of_stay: number | string | null;
	average_booking_value: number | string | null;
	contribution_to_revenue: number | string | null;
	booking_lead_time_days: number | null;
	cancellation_rate: number | string | null;
	no_show_rate: number | string | null;
	repeat_guest_rate: number | string | null;
	total_bookings: number;
	total_room_nights: number;
	total_revenue: number | string | null;
	rate_multiplier: number | string;
	discount_percentage: number | string | null;
	premium_percentage: number | string | null;
	pays_commission: boolean;
	commission_percentage: number | string | null;
	marketing_priority: number;
	is_target_segment: boolean;
	lifetime_value: number | string | null;
	loyalty_program_eligible: boolean;
	loyalty_points_multiplier: number | string;
	ranking: number | null;
	color_code: string | null;
	description: string | null;
	created_at: string | Date | null;
	updated_at: string | Date | null;
};

// =====================================================
// CHANNEL MAPPING ROW
// =====================================================

/** Raw row shape from channel_mappings table. */
export type ChannelMappingRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	channel_name: string;
	channel_code: string;
	entity_type: string;
	entity_id: string;
	external_id: string;
	external_code: string | null;
	mapping_config: Record<string, unknown> | null;
	last_sync_at: string | Date | null;
	last_sync_status: string | null;
	last_sync_error: string | null;
	is_active: boolean;
	created_at: string | Date;
	updated_at: string | Date | null;
};

// =====================================================
// COMPANY ROW
// =====================================================

/** Raw row shape from companies table with contract and financial data. */
export type CompanyRow = {
	company_id: string;
	tenant_id: string;
	company_name: string;
	legal_name: string | null;
	company_code: string | null;
	company_type: string;
	primary_contact_name: string | null;
	primary_contact_email: string | null;
	primary_contact_phone: string | null;
	billing_contact_name: string | null;
	billing_contact_email: string | null;
	city: string | null;
	state_province: string | null;
	country: string | null;
	credit_limit: number | string;
	current_balance: number | string;
	payment_terms: number;
	payment_terms_type: string;
	credit_status: string;
	commission_rate: number | string;
	commission_type: string | null;
	preferred_rate_code: string | null;
	discount_percentage: number | string;
	tax_id: string | null;
	tax_exempt: boolean;
	contract_number: string | null;
	contract_start_date: string | Date | null;
	contract_end_date: string | Date | null;
	contract_status: string | null;
	iata_number: string | null;
	arc_number: string | null;
	total_bookings: number;
	total_revenue: number | string;
	average_booking_value: number | string | null;
	last_booking_date: string | Date | null;
	is_active: boolean;
	is_vip: boolean;
	is_blacklisted: boolean;
	requires_approval: boolean;
	created_at: string | Date;
	updated_at: string | Date | null;
};

// =====================================================
// WAITLIST ENTRY ROW
// =====================================================

/** Raw row shape from waitlist_entries table. */
export type WaitlistEntryRow = {
	waitlist_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	guest_id: string | null;
	guest_name: string | null;
	reservation_id: string | null;
	requested_room_type_id: string | null;
	room_type_name: string | null;
	requested_rate_id: string | null;
	arrival_date: string | Date;
	departure_date: string | Date;
	nights: number;
	number_of_rooms: number;
	number_of_adults: number;
	number_of_children: number;
	flexibility: string;
	waitlist_status: string;
	priority_score: number;
	vip_flag: boolean;
	last_notified_at: string | Date | null;
	last_notified_via: string | null;
	offer_expiration_at: string | Date | null;
	offer_response: string | null;
	offer_response_at: string | Date | null;
	notes: string | null;
	created_at: string | Date;
	updated_at: string | Date | null;
};

// =====================================================
// GROUP BOOKING ROW
// =====================================================

/** Raw row shape from group_bookings (room block) table. */
export type GroupBookingRow = {
	group_booking_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	group_name: string;
	group_code: string | null;
	group_type: string;
	block_status: string;
	company_id: string | null;
	company_name: string | null;
	organization_name: string | null;
	event_name: string | null;
	event_type: string | null;
	contact_name: string;
	contact_email: string | null;
	contact_phone: string | null;
	arrival_date: string;
	departure_date: string;
	number_of_nights: number | null;
	total_rooms_requested: number;
	total_rooms_blocked: number | null;
	total_rooms_picked: number | null;
	total_rooms_confirmed: number | null;
	cutoff_date: string;
	cutoff_days_before_arrival: number | null;
	release_unsold_rooms: boolean | null;
	rooming_list_received: boolean | null;
	rooming_list_deadline: string | null;
	deposit_amount: string | null;
	deposit_received: boolean | null;
	negotiated_rate: string | null;
	estimated_total_revenue: string | null;
	actual_revenue: string | null;
	contract_signed: boolean | null;
	is_active: boolean;
	booking_confidence: string | null;
	account_manager_id: string | null;
	account_manager_name: string | null;
	sales_manager_id: string | null;
	created_at: string;
	updated_at: string | null;
};

// =====================================================
// PROMOTIONAL CODE ROW
// =====================================================

/** Raw row shape from promotional_codes table with usage statistics. */
export type PromotionalCodeRow = {
	promo_id: string;
	tenant_id: string;
	property_id: string | null;
	property_name: string | null;
	promo_code: string;
	promo_name: string;
	promo_description: string | null;
	promo_type: string | null;
	promo_status: string | null;
	is_active: boolean | null;
	is_public: boolean | null;
	valid_from: string;
	valid_to: string;
	discount_type: string | null;
	discount_percent: string | null;
	discount_amount: string | null;
	discount_currency: string | null;
	max_discount_amount: string | null;
	free_nights_count: number | null;
	has_usage_limit: boolean | null;
	total_usage_limit: number | null;
	usage_count: number | null;
	remaining_uses: number | null;
	per_user_limit: number | null;
	minimum_stay_nights: number | null;
	maximum_stay_nights: number | null;
	minimum_booking_amount: string | null;
	times_viewed: number | null;
	times_applied: number | null;
	times_redeemed: number | null;
	total_discount_given: string | null;
	total_revenue_generated: string | null;
	conversion_rate: string | null;
	combinable_with_other_promos: boolean | null;
	auto_apply: boolean | null;
	display_on_website: boolean | null;
	requires_approval: boolean | null;
	campaign_id: string | null;
	marketing_source: string | null;
	created_at: string;
	updated_at: string | null;
};
