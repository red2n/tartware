/**
 * DEV DOC
 * Module: api/rooms-rows.ts
 * Purpose: Raw PostgreSQL row shapes for rooms-service query results.
 * Ownership: Schema package
 */

// =====================================================
// ROOM LIST ROW
// =====================================================

/** Raw row shape from rooms list query with joined type data. */
export type RoomListRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	property_name: string | null;
	room_type_id: string | null;
	room_type_name: string | null;
	room_type_amenities: string[] | null;
	room_number: string;
	room_name: string | null;
	floor: string | null;
	building: string | null;
	building_id: string | null;
	wing: string | null;
	status: string | null;
	housekeeping_status: string | null;
	maintenance_status: string | null;
	features: Record<string, unknown> | null;
	amenities: string[] | null;
	is_blocked: boolean | null;
	block_reason: string | null;
	is_out_of_order: boolean | null;
	out_of_order_reason: string | null;
	expected_ready_date: string | Date | null;
	housekeeping_notes: string | null;
	metadata: Record<string, unknown> | null;
	updated_at: string | Date | null;
	version: bigint | null;
};

// =====================================================
// ROOM TYPE ROW
// =====================================================

/** Raw row shape from room_types table query. */
export type RoomTypeRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	type_name: string;
	type_code: string;
	description: string | null;
	short_description: string | null;
	category: string | null;
	base_occupancy: number | null;
	max_occupancy: number | null;
	max_adults: number | null;
	max_children: number | null;
	extra_bed_capacity: number | null;
	size_sqm: string | number | null;
	bed_type: string | null;
	number_of_beds: number | null;
	amenities: unknown;
	features: unknown;
	base_price: string | number | null;
	currency: string | null;
	images: unknown;
	display_order: number | null;
	is_active: boolean | null;
	metadata: unknown;
	created_at: string | Date | null;
	updated_at: string | Date | null;
	version: bigint | null;
};

// =====================================================
// BUILDING ROW
// =====================================================

/** Raw row shape from buildings table query. */
export type BuildingRow = {
	building_id: string;
	tenant_id: string;
	property_id: string;
	building_code: string;
	building_name: string;
	building_type: string;
	floor_count: number | null;
	basement_floors: number | null;
	total_rooms: number | null;
	wheelchair_accessible: boolean | null;
	elevator_count: number | null;
	has_lobby: boolean | null;
	has_pool: boolean | null;
	has_gym: boolean | null;
	has_spa: boolean | null;
	has_restaurant: boolean | null;
	has_parking: boolean | null;
	parking_spaces: number | null;
	year_built: number | null;
	last_renovation_year: number | null;
	is_active: boolean | null;
	building_status: string | null;
	photo_url: string | null;
	guest_description: string | null;
	internal_notes: string | null;
	metadata: unknown;
	created_at: string | Date | null;
	updated_at: string | Date | null;
	version: bigint | null;
};

// =====================================================
// RATE ROW
// =====================================================

/** Raw row shape from rate_plans table query. */
export type RateRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	room_type_id: string;
	rate_name: string;
	rate_code: string;
	description: string | null;
	rate_type: string | null;
	strategy: string | null;
	priority: number | null;
	base_rate: number | null;
	currency: string | null;
	single_occupancy_rate: number | null;
	double_occupancy_rate: number | null;
	extra_person_rate: number | null;
	extra_child_rate: number | null;
	valid_from: string | Date | null;
	valid_until: string | Date | null;
	advance_booking_days_min: number | null;
	advance_booking_days_max: number | null;
	min_length_of_stay: number | null;
	max_length_of_stay: number | null;
	closed_to_arrival: boolean | null;
	closed_to_departure: boolean | null;
	meal_plan: string | null;
	meal_plan_cost: number | null;
	cancellation_policy: unknown;
	modifiers: unknown;
	channels: unknown;
	customer_segments: unknown;
	tax_inclusive: boolean | null;
	tax_rate: number | null;
	status: string | null;
	display_order: number | null;
	metadata: unknown;
	created_at: string | Date | null;
	updated_at: string | Date | null;
	version: bigint | null;
};

// =====================================================
// RATE CALENDAR ROW
// =====================================================

/** Raw row shape from rate_calendar table query. */
export type CalendarRow = {
	id: string;
	tenant_id: string;
	property_id: string;
	room_type_id: string;
	rate_id: string;
	stay_date: string | Date;
	rate_amount: string | number;
	currency: string;
	single_rate: string | number | null;
	double_rate: string | number | null;
	extra_person: string | number | null;
	extra_child: string | number | null;
	status: string;
	closed_to_arrival: boolean;
	closed_to_departure: boolean;
	min_length_of_stay: number | null;
	max_length_of_stay: number | null;
	min_advance_days: number | null;
	max_advance_days: number | null;
	rooms_to_sell: number | null;
	rooms_sold: number;
	source: string;
};
