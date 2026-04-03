/**
 * DEV DOC
 * Module: api/report-rows.ts
 * Purpose: Raw PostgreSQL row shapes for core-service report service queries —
 *          reservation status summaries, revenue summaries, occupancy data,
 *          revenue KPIs, and guest lists (arrivals/departures/in-house).
 * Ownership: Schema package
 */

// =====================================================
// RESERVATION STATUS ROW
// =====================================================

/** Raw row from reservation status count aggregate query. */
export type ReservationStatusRow = {
	status: string | null;
	count: string | number | null;
};

// =====================================================
// REVENUE SUMMARY ROW
// =====================================================

/** Raw row from revenue summary aggregate query (today / MTD / YTD buckets). */
export type RevenueSummaryRow = {
	revenue_today: string | number | null;
	revenue_month: string | number | null;
	revenue_year: string | number | null;
};

// =====================================================
// RESERVATION SOURCE ROW
// =====================================================

/** Raw row from reservation source breakdown query. */
export type ReservationSourceRow = {
	source: string | null;
	reservations: string | number | null;
	total_amount: string | number | null;
};

// =====================================================
// OCCUPANCY ROW
// =====================================================

/** Raw row from daily occupancy report query. */
export type OccupancyRow = {
	date: string;
	total_rooms: number | string;
	rooms_sold: number | string;
	rooms_available: number | string;
	occupancy_pct: number | string;
};

// =====================================================
// REVENUE KPI ROW
// =====================================================

/** Raw row from revenue KPI (ADR / RevPAR / TRevPAR) aggregate query. */
export type RevenueKpiRow = {
	total_room_revenue: string | number;
	total_revenue: string | number;
	rooms_sold: string | number;
	available_room_nights: string | number;
	occupancy_pct: string | number;
	adr: string | number;
	revpar: string | number;
	trevpar: string | number;
};

// =====================================================
// GUEST LIST ROW
// =====================================================

/** Raw row from arrivals / departures / in-house guest list queries. */
export type GuestListRow = {
	reservation_id: string;
	confirmation_number: string;
	guest_name: string;
	guest_email: string | null;
	guest_phone: string | null;
	room_number: string | null;
	room_type: string | null;
	check_in_date: string;
	check_out_date: string;
	status: string;
	source: string | null;
	special_requests: string | null;
	eta: string | null;
	number_of_adults: number | string | null;
	number_of_children: number | string | null;
	vip: boolean;
};
