/**
 * DEV DOC
 * Module: api/operations-rows.ts
 * Purpose: Raw PostgreSQL row shapes for core-service operations and night-audit
 *          service queries — shift handovers, lost & found, banquet event orders,
 *          guest feedback, police reports, business date status, night audit runs,
 *          night audit steps, OTA connections, OTA sync logs.
 * Ownership: Schema package
 */

// =====================================================
// SHIFT HANDOVER ROW
// =====================================================

/** Raw row shape from shift_handovers table query with joined property + user data. */
export type ShiftHandoverRow = {
	handover_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	handover_number: string | null;
	handover_title: string | null;
	shift_date: Date | string;
	outgoing_shift: string;
	outgoing_user_id: string;
	outgoing_user_name: string | null;
	incoming_shift: string;
	incoming_user_id: string;
	incoming_user_name: string | null;
	department: string;
	department_display: string;
	handover_status: string;
	handover_status_display: string;
	handover_started_at: Date | string | null;
	handover_completed_at: Date | string | null;
	current_occupancy_percent: string | null;
	expected_arrivals_count: number | null;
	expected_departures_count: number | null;
	tasks_pending: number | null;
	tasks_urgent: number | null;
	key_points: string;
	requires_follow_up: boolean | null;
	acknowledged: boolean | null;
	created_at: Date | string | null;
};

// =====================================================
// BANQUET EVENT ORDER ROW
// =====================================================

/** Raw row shape from banquet_event_orders (BEO) table query. */
export type BanquetOrderRow = {
	beo_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	event_booking_id: string;
	beo_number: string;
	beo_version: number | null;
	beo_status: string;
	beo_status_display: string;
	event_date: Date | string;
	event_start_time: string;
	event_end_time: string;
	meeting_room_id: string;
	meeting_room_name: string | null;
	room_setup: string;
	room_setup_display: string;
	guaranteed_count: number;
	expected_count: number | null;
	actual_count: number | null;
	menu_type: string | null;
	service_style: string | null;
	bar_type: string | null;
	food_subtotal: string | null;
	beverage_subtotal: string | null;
	total_estimated: string | null;
	total_actual: string | null;
	client_approved: boolean | null;
	chef_approved: boolean | null;
	manager_approved: boolean | null;
	setup_completed: boolean | null;
	event_started: boolean | null;
	event_ended: boolean | null;
	created_at: Date | string;
	/** Derived: a later revision points back at this row. */
	is_superseded: boolean;
};

/**
 * Raw row shape from the BEO by-id query, which selects the whole document.
 *
 * `DECIMAL` and `TIME` columns come back as strings because the query casts them
 * `::TEXT`; `JSONB` columns come back already parsed by `pg`.
 */
export type BanquetOrderDetailRow = BanquetOrderRow & {
	revision_date: Date | string | null;
	revision_reason: string | null;
	previous_beo_id: string | null;
	setup_start_time: string;
	teardown_end_time: string | null;
	room_release_time: string | null;
	tables_count: number | null;
	chairs_count: number | null;
	table_configuration: string | null;
	seating_chart_layout_url: string | null;
	over_set_percentage: string | null;
	menu_items: unknown;
	courses_count: number | null;
	meal_service_start_time: string | null;
	meal_service_duration_minutes: number | null;
	appetizers: unknown;
	salads: unknown;
	entrees: unknown;
	sides: unknown;
	desserts: unknown;
	stations: unknown;
	bar_start_time: string | null;
	bar_end_time: string | null;
	bar_setup_location: string | null;
	beverages: unknown;
	wine_service: unknown;
	coffee_tea_service: boolean | null;
	water_service: string | null;
	vegetarian_count: number | null;
	vegan_count: number | null;
	gluten_free_count: number | null;
	dairy_free_count: number | null;
	nut_free_count: number | null;
	kosher_count: number | null;
	halal_count: number | null;
	special_diets: unknown;
	linen_color: string | null;
	linen_type: string | null;
	napkin_color: string | null;
	napkin_fold: string | null;
	table_skirting: boolean | null;
	centerpieces: string | null;
	decor_description: string | null;
	candles: boolean | null;
	floral_arrangements: string | null;
	equipment_list: unknown;
	av_equipment: unknown;
	stage_required: boolean | null;
	stage_dimensions: string | null;
	podium_required: boolean | null;
	dance_floor_required: boolean | null;
	special_lighting: boolean | null;
	lighting_notes: string | null;
	servers_count: number | null;
	bartenders_count: number | null;
	chefs_count: number | null;
	captains_count: number | null;
	coat_check_attendants: number | null;
	valet_attendants: number | null;
	security_guards: number | null;
	staff_arrival_time: string | null;
	staff_meal_time: string | null;
	staff_break_schedule: string | null;
	overtime_authorized: boolean | null;
	equipment_rental_total: string | null;
	labor_charges: string | null;
	service_charge_percent: string | null;
	service_charge_amount: string | null;
	gratuity_percent: string | null;
	gratuity_amount: string | null;
	tax_percent: string | null;
	tax_amount: string | null;
	currency_code: string | null;
	billing_type: string | null;
	price_per_person: string | null;
	children_price: string | null;
	children_count: number | null;
	kitchen_instructions: string | null;
	service_instructions: string | null;
	setup_instructions: string | null;
	cleanup_instructions: string | null;
	audio_visual_instructions: string | null;
	client_approved_date: Date | string | null;
	client_approved_by: string | null;
	client_signature_url: string | null;
	chef_approved_date: Date | string | null;
	chef_approved_by: string | null;
	manager_approved_date: Date | string | null;
	manager_approved_by: string | null;
	setup_completed_time: Date | string | null;
	event_started_time: Date | string | null;
	event_ended_time: Date | string | null;
	teardown_completed: boolean | null;
	teardown_completed_time: Date | string | null;
	post_event_notes: string | null;
	issues_encountered: string | null;
	client_satisfaction_rating: number | null;
	photos: unknown;
	last_sent_to_client: Date | string | null;
	last_sent_to_kitchen: Date | string | null;
	last_sent_to_setup: Date | string | null;
	distribution_list: string[] | null;
	signed_beo_url: string | null;
	floor_plan_url: string | null;
	seating_chart_document_url: string | null;
	menu_card_url: string | null;
	internal_notes: string | null;
	client_notes: string | null;
	allergy_warnings: string | null;
	metadata: unknown;
	updated_at: Date | string | null;
};

// =====================================================
// GUEST FEEDBACK ROW
// =====================================================

/** Raw row shape from guest_feedback / reviews table query. */
export type GuestFeedbackRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	guest_id: string | null;
	guest_name: string | null;
	reservation_id: string | null;
	feedback_source: string | null;
	feedback_source_display: string | null;
	overall_rating: string | null;
	rating_scale: number | null;
	cleanliness_rating: string | null;
	staff_rating: string | null;
	location_rating: string | null;
	value_rating: string | null;
	review_title: string | null;
	review_text: string | null;
	would_recommend: boolean | null;
	would_return: boolean | null;
	sentiment_label: string | null;
	is_verified: boolean | null;
	is_public: boolean | null;
	is_featured: boolean | null;
	response_text: string | null;
	responded_at: Date | string | null;
	created_at: Date | string | null;
	feedback_status: string | null;
	feedback_status_display: string | null;
	feedback_category: string | null;
	assigned_to: string | null;
	assigned_at: Date | string | null;
	resolution_notes: string | null;
	resolved_at: Date | string | null;
	service_recovery_reference: string | null;
};

/**
 * Service-layer input for logging a piece of guest feedback. Camel-cased
 * counterpart of `GuestFeedbackWriteBodySchema`; lives here because AGENTS.md
 * requires service-layer shapes in the schema package, not in a service file.
 */
export type GuestFeedbackWriteInput = {
	propertyId: string;
	feedbackSource: string;
	reviewText: string;
	guestId?: string;
	reservationId?: string;
	reviewTitle?: string;
	overallRating?: number;
	ratingScale?: number;
	cleanlinessRating?: number;
	staffRating?: number;
	locationRating?: number;
	valueRating?: number;
	wouldRecommend?: boolean;
	wouldReturn?: boolean;
	feedbackCategory?: string;
	sentimentLabel?: string;
	isPublic?: boolean;
	languageCode?: string;
};

// =====================================================
// POLICE REPORT ROW
// =====================================================

/** Raw row shape from police_reports table query. */
export type PoliceReportRow = {
	report_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	report_number: string;
	police_case_number: string | null;
	incident_id: string | null;
	incident_date: Date | string;
	incident_time: string | null;
	reported_date: Date | string;
	incident_type: string | null;
	incident_type_display: string | null;
	incident_description: string;
	incident_location: string | null;
	room_number: string | null;
	agency_name: string;
	responding_officer_name: string | null;
	report_status: string;
	report_status_display: string;
	suspect_count: number | null;
	victim_count: number | null;
	guest_involved: boolean | null;
	staff_involved: boolean | null;
	property_stolen: boolean | null;
	total_loss_value: string | null;
	arrests_made: boolean | null;
	investigation_ongoing: boolean | null;
	resolved: boolean | null;
	confidential: boolean | null;
	created_at: Date | string | null;
};

// =====================================================
// BUSINESS DATE ROW
// =====================================================

/** Raw row shape from business_dates table query (current date status). */
export type BusinessDateRow = {
	business_date_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	business_date: Date | string;
	system_date: Date | string;
	date_status: string;
	night_audit_status: string | null;
	night_audit_started_at: Date | string | null;
	night_audit_completed_at: Date | string | null;
	is_locked: boolean | null;
	allow_postings: boolean | null;
	allow_check_ins: boolean | null;
	allow_check_outs: boolean | null;
	arrivals_count: number | null;
	departures_count: number | null;
	stayovers_count: number | null;
	total_revenue: string | null;
	audit_errors: number | null;
	audit_warnings: number | null;
	is_reconciled: boolean | null;
	notes: string | null;
};

// =====================================================
// NIGHT AUDIT RUN ROW
// =====================================================

/** Raw row shape from night_audit_runs table query (history list row). */
export type NightAuditRunRow = {
	audit_run_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	business_date: Date | string;
	next_business_date: Date | string | null;
	audit_status: string;
	execution_mode: string | null;
	is_test_run: boolean | null;
	started_at: Date | string;
	completed_at: Date | string | null;
	duration_seconds: number | null;
	total_steps: number;
	steps_completed: number;
	steps_failed: number;
	error_count: number | null;
	warning_count: number | null;
	is_successful: boolean | null;
	requires_attention: boolean | null;
	is_acknowledged: boolean | null;
	initiated_by: string;
	initiated_by_name: string | null;
	occupancy_percent: string | null;
	adr: string | null;
	revpar: string | null;
	total_revenue: string | null;
	total_rooms_sold: number | null;
};

// =====================================================
// NIGHT AUDIT STEP ROW
// =====================================================

/** Raw row shape from night_audit_log JOIN night_audit_runs query (run detail). */
export type NightAuditStepRow = {
	audit_log_id: string;
	audit_run_id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	business_date: Date | string;
	next_business_date: Date | string | null;
	started_at: Date | string;
	completed_at: Date | string | null;
	duration_seconds: number | null;
	audit_status: string;
	step_number: number;
	step_name: string;
	step_category: string | null;
	step_status: string;
	step_started_at: Date | string | null;
	step_completed_at: Date | string | null;
	step_duration_ms: number | null;
	records_processed: number | null;
	records_succeeded: number | null;
	records_failed: number | null;
	records_skipped: number | null;
	amount_posted: string | null;
	transactions_created: number | null;
	error_count: number | null;
	warning_count: number | null;
	error_message: string | null;
	initiated_by: string;
	initiated_by_name: string | null;
	execution_mode: string | null;
	is_test_run: boolean | null;
	occupancy_percent: string | null;
	adr: string | null;
	revpar: string | null;
	total_revenue: string | null;
	total_rooms_sold: number | null;
	is_successful: boolean | null;
	requires_attention: boolean | null;
	is_acknowledged: boolean | null;
	reports_generated: string[] | null;
	actions_taken: string[] | null;
	notes: string | null;
	resolution_notes: string | null;
};

// =====================================================
// OTA CONNECTION ROW
// =====================================================

/** Raw row shape from ota_connections table query. */
export type OtaConnectionRow = {
	ota_connection_id: string;
	tenant_id: string;
	property_id: string | null;
	property_name: string | null;
	channel_code: string;
	channel_name: string;
	channel_type: string | null;
	connection_status: string;
	is_active: boolean | null;
	is_two_way_sync: boolean | null;
	last_sync_at: Date | string | null;
	last_sync_status: string | null;
	last_error_message: string | null;
	sync_frequency_minutes: number | null;
	rooms_mapped: number | null;
	rates_mapped: number | null;
	pending_reservations: number | null;
	api_version: string | null;
	created_at: Date | string;
	updated_at: Date | string | null;
};

// =====================================================
// OTA SYNC LOG ROW
// =====================================================

/** Raw row shape from ota_sync_logs table query. */
export type OtaSyncLogRow = {
	sync_log_id: string;
	ota_connection_id: string;
	sync_type: string;
	sync_direction: string;
	sync_status: string;
	started_at: Date | string;
	completed_at: Date | string | null;
	duration_ms: number | null;
	records_processed: number | null;
	records_created: number | null;
	records_updated: number | null;
	records_failed: number | null;
	error_message: string | null;
	triggered_by: string | null;
};
