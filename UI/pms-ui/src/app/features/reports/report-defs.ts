/**
 * Report catalogue — the single source of truth for the Reports screen and for
 * the sub-sidebar entries in nav-config. Kept free of component imports so the
 * eagerly-loaded nav can read it without pulling in the lazy Reports chunk.
 */

/**
 * Query contract of a report's backend route, mirroring its Fastify schema.
 * Sending anything else is at best ignored and at worst a 400, so each report
 * declares exactly what its endpoint accepts.
 *
 *  - `range-paged`   start_date + end_date (required) and limit  — DateRangeReportQuery
 *  - `range`         start_date + end_date (required), no paging — finance DateRangeQuery
 *  - `business-date` business_date only
 *  - `paged`         limit only
 */
export type ReportQuery = "range-paged" | "range" | "business-date" | "paged";

export interface ReportDef {
	readonly key: string;
	readonly label: string;
	readonly description: string;
	readonly path: string;
	readonly query: ReportQuery;
	readonly icon: string;
}

export const REPORTS: readonly ReportDef[] = [
	{
		key: "arrivals",
		label: "Arrivals",
		description: "Expected arrivals for the date range.",
		path: "/reports/arrivals",
		query: "range-paged",
		icon: "flight_land",
	},
	{
		key: "departures",
		label: "Departures",
		description: "Expected departures for the date range.",
		path: "/reports/departures",
		query: "range-paged",
		icon: "flight_takeoff",
	},
	{
		key: "in-house",
		label: "In-House",
		description: "Currently in-house guests.",
		path: "/reports/in-house",
		query: "paged",
		icon: "hotel",
	},
	{
		key: "no-show",
		label: "No-Show",
		description: "No-show reservations for the date range.",
		path: "/reports/no-shows",
		query: "range-paged",
		icon: "person_off",
	},
	{
		key: "occupancy",
		label: "Occupancy",
		description: "Occupancy statistics for the date range.",
		path: "/reports/occupancy",
		query: "range-paged",
		icon: "meeting_room",
	},
	{
		key: "revenue-summary",
		label: "Revenue Summary",
		description: "Gross and net revenue broken down by department.",
		path: "/billing/reports/departmental-revenue",
		query: "range",
		icon: "payments",
	},
	{
		key: "str-metrics",
		label: "STR Metrics",
		description: "ADR, RevPAR, TRevPAR and occupancy for the date range.",
		path: "/reports/revenue-kpis",
		query: "range-paged",
		icon: "leaderboard",
	},
	{
		key: "manager-flash",
		label: "Manager Flash",
		description: "Key daily metrics snapshot for management.",
		path: "/reports/flash",
		query: "business-date",
		icon: "flash_on",
	},
	{
		key: "forecast",
		label: "Forecast",
		description: "Demand forecast for the date range.",
		path: "/reports/demand-forecast",
		query: "range-paged",
		icon: "insights",
	},
	{
		key: "housekeeping-status",
		label: "Housekeeping",
		description: "Housekeeping productivity for the business date.",
		path: "/reports/housekeeping-productivity",
		query: "business-date",
		icon: "cleaning_services",
	},

	{
		key: "vip-arrivals",
		label: "VIP Arrivals",
		description: "Arriving VIP guests for the date range.",
		path: "/reports/vip-arrivals",
		query: "range-paged",
		icon: "star",
	},
	{
		key: "pace",
		label: "Booking Pace",
		description: "Bookings taken per day against the same point last year.",
		path: "/reports/pace",
		query: "range-paged",
		icon: "speed",
	},
	{
		key: "market-segment-production",
		label: "Market Segment Production",
		description: "Room nights and revenue by market segment.",
		path: "/reports/market-segment-production",
		query: "range-paged",
		icon: "donut_small",
	},
	{
		key: "guest-statistics",
		label: "Guest Statistics",
		description: "Guest counts, nationalities and repeat-stay mix.",
		path: "/reports/guest-statistics",
		query: "paged",
		icon: "groups",
	},
	{
		key: "maintenance-sla",
		label: "Maintenance SLA",
		description: "Maintenance response and resolution times against SLA.",
		path: "/reports/maintenance-sla",
		query: "range-paged",
		icon: "build",
	},
	{
		key: "performance",
		label: "Performance",
		description: "Occupancy, ADR and RevPAR performance for the date range.",
		path: "/reports/performance",
		query: "range-paged",
		icon: "query_stats",
	},
	{
		key: "revenue-forecast",
		label: "Revenue Forecast",
		description: "Forward revenue forecast for the date range.",
		path: "/reports/revenue-forecast",
		query: "range-paged",
		icon: "trending_up",
	},
];
