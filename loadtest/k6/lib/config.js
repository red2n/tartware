/**
 * Configuration module for Tartware load tests
 * Centralizes environment variables and default settings
 */

// Base URLs
export const GATEWAY_URL = __ENV.GATEWAY_URL || "http://localhost:8080";

// Authentication
export const API_TOKEN = __ENV.API_TOKEN || "";

// Test entities (seed data)
export const TENANT_ID =
	__ENV.TENANT_ID || "11111111-1111-1111-1111-111111111111";
export const PROPERTY_ID =
	__ENV.PROPERTY_ID || "22222222-2222-2222-2222-222222222222";
export const ROOM_TYPE_ID =
	__ENV.ROOM_TYPE_ID || "44444444-4444-4444-4444-444444444444";
export const USER_ID =
	__ENV.USER_ID || "33333333-3333-3333-3333-333333333333";

// Service ports (for direct service testing)
export const SERVICE_PORTS = {
	gateway: 8080,
	core: 3000,
	settings: 3100,
	guests: 3300,
	rooms: 3400,
	housekeeping: 3500,
	billing: 3600,
	commandCenter: 3700,
};

// Test parameters
export const VUS = Number(__ENV.VUS) || 50;
export const DURATION = __ENV.DURATION || "5m";
export const RAMP_UP = __ENV.RAMP_UP || "30s";

// Thresholds
export const DEFAULT_THRESHOLDS = {
	http_req_failed: ["rate<0.01"], // <1% errors
	http_req_duration: ["p(95)<500", "p(99)<1000"], // p95 < 500ms, p99 < 1s
	checks: ["rate>0.95"], // >95% checks pass
};

// Request headers
export function getHeaders() {
	if (!API_TOKEN) {
		console.warn(
			"WARNING: API_TOKEN not set. Authenticated requests will fail.",
		);
	}
	return {
		Authorization: `Bearer ${API_TOKEN}`,
		"Content-Type": "application/json",
		Accept: "application/json",
		"User-Agent": "tartware-k6-loadtest/1.0",
	};
}

// Service endpoints mapping
export const ENDPOINTS = {
	// Health
	health: "/health",

	// Auth
	login: "/v1/auth/login",

	// Core Service
	tenants: "/v1/tenants",
	properties: "/v1/properties",
	users: "/v1/users",
	modules: "/v1/modules",

	// Rooms Service
	rooms: "/v1/rooms",
	roomTypes: "/v1/room-types",

	// Guests Service
	guests: "/v1/guests",
	guestPreferences: "/v1/guest-preferences",
	guestCommunications: "/v1/guest-communications",

	// Billing Service
	payments: "/v1/billing/payments",
	invoices: "/v1/billing/invoices",
	folios: "/v1/billing/folios",
	taxConfigurations: "/v1/billing/tax-configurations",

	// Housekeeping Service
	housekeepingTasks: "/v1/housekeeping/tasks",
	maintenanceRequests: "/v1/maintenance-requests",
	incidentReports: "/v1/incident-reports",

	// Reservations
	reservations: "/v1/reservations",
	availability: "/v1/availability",
	waitlist: "/v1/waitlist",

	// Recommendations
	recommendations: "/v1/recommendations",
	recommendationsRank: "/v1/recommendations/rank",

	// Booking Config
	allotments: "/v1/allotments",
	bookingSources: "/v1/booking-sources",
	marketSegments: "/v1/market-segments",
	channelMappings: "/v1/channel-mappings",
	companies: "/v1/companies",
	meetingRooms: "/v1/meeting-rooms",
	eventBookings: "/v1/event-bookings",
	waitlist: "/v1/waitlist",

	// Settings
	rates: "/v1/rates",
	ratePlans: "/v1/settings/rate-plans",
	packages: "/v1/settings/packages",
	amenities: "/v1/amenities",
	cancellationPolicies: "/v1/settings/cancellation-policies",
	depositPolicies: "/v1/settings/deposit-policies",
	seasons: "/v1/settings/seasons",
	configurations: "/v1/settings/configurations",
};

export default {
	GATEWAY_URL,
	API_TOKEN,
	TENANT_ID,
	PROPERTY_ID,
	ROOM_TYPE_ID,
	USER_ID,
	SERVICE_PORTS,
	VUS,
	DURATION,
	RAMP_UP,
	DEFAULT_THRESHOLDS,
	getHeaders,
	ENDPOINTS,
};
