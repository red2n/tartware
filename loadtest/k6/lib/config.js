/**
 * Fresh load testing configuration (v2)
 * Focused on realistic PMS business transactions.
 */

export const GATEWAY_URL = __ENV.GATEWAY_URL || "http://localhost:8080";

export const API_TOKEN = __ENV.API_TOKEN || "";
export const ADMIN_USERNAME = __ENV.ADMIN_USERNAME || "setup.admin";
export const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "TempPass123";

const defaultTenantId = "11111111-1111-1111-1111-111111111111";
const defaultPropertyId = "22222222-2222-2222-2222-222222222222";
const defaultRoomTypeId = "44444444-4444-4444-4444-444444444444";

function parseCsv(value, fallback) {
	if (!value) return fallback;
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export const TENANT_IDS = parseCsv(__ENV.TENANT_IDS, [defaultTenantId]);
export const PROPERTY_IDS = parseCsv(__ENV.PROPERTY_IDS, [defaultPropertyId]);
export const ROOM_TYPE_IDS = parseCsv(__ENV.ROOM_TYPE_IDS, [defaultRoomTypeId]);
export const RATE_CODE = __ENV.RATE_CODE || "BAR";

export const VUS = Number(__ENV.VUS) || 50;
export const DURATION = __ENV.DURATION || "5m";
export const RAMP_UP = __ENV.RAMP_UP || "30s";

const WORKLOAD_PROFILES = {
	"ota-heavy": {
		availability: 0.42,
		reservationCreate: 0.1,
		reservationModify: 0.07,
		reservationCancel: 0.05,
		otaSync: 0.14,
		checkIn: 0.04,
		checkOut: 0.04,
		payment: 0.06,
		reporting: 0.08,
	},
	"direct-heavy": {
		availability: 0.38,
		reservationCreate: 0.14,
		reservationModify: 0.08,
		reservationCancel: 0.05,
		otaSync: 0.08,
		checkIn: 0.05,
		checkOut: 0.05,
		payment: 0.09,
		reporting: 0.08,
	},
	"enterprise-mix": {
		availability: 0.4,
		reservationCreate: 0.1,
		reservationModify: 0.06,
		reservationCancel: 0.04,
		otaSync: 0.12,
		checkIn: 0.05,
		checkOut: 0.05,
		payment: 0.08,
		reporting: 0.1,
	},
};

function hasExplicitRatioOverrides() {
	return [
		__ENV.AVAILABILITY_RATIO,
		__ENV.RES_CREATE_RATIO,
		__ENV.RES_MODIFY_RATIO,
		__ENV.RES_CANCEL_RATIO,
		__ENV.OTA_SYNC_RATIO,
		__ENV.CHECKIN_RATIO,
		__ENV.CHECKOUT_RATIO,
		__ENV.PAYMENT_RATIO,
		__ENV.REPORTING_RATIO,
	].some((value) => value !== undefined && value !== "");
}

function normalizeRatios(ratios) {
	const total = Object.values(ratios).reduce((sum, value) => sum + value, 0);
	if (!total) return ratios;
	return Object.fromEntries(
		Object.entries(ratios).map(([key, value]) => [key, value / total]),
	);
}

const profileName = __ENV.WORKLOAD_PROFILE || "ota-heavy";
const profileRatios = WORKLOAD_PROFILES[profileName] || WORKLOAD_PROFILES["ota-heavy"];

const overrideRatios = {
	availability: Number(__ENV.AVAILABILITY_RATIO) || 0,
	reservationCreate: Number(__ENV.RES_CREATE_RATIO) || 0,
	reservationModify: Number(__ENV.RES_MODIFY_RATIO) || 0,
	reservationCancel: Number(__ENV.RES_CANCEL_RATIO) || 0,
	otaSync: Number(__ENV.OTA_SYNC_RATIO) || 0,
	checkIn: Number(__ENV.CHECKIN_RATIO) || 0,
	checkOut: Number(__ENV.CHECKOUT_RATIO) || 0,
	payment: Number(__ENV.PAYMENT_RATIO) || 0,
	reporting: Number(__ENV.REPORTING_RATIO) || 0,
};

const baseRatios = hasExplicitRatioOverrides() ? overrideRatios : profileRatios;

export const WORKLOAD_RATIOS = normalizeRatios(baseRatios);

export const DEFAULT_THRESHOLDS = {
	http_req_failed: ["rate<0.01"],
	http_req_duration: ["p(95)<500", "p(99)<1000"],
	checks: ["rate>0.95"],
};

export function getHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
		Accept: "application/json",
		"User-Agent": "tartware-k6-loadtest/2.0",
	};
}

export const ENDPOINTS = {
	health: "/health",
	login: "/v1/auth/login",
	commands: "/v1/commands",
	tenants: "/v1/tenants",
	properties: "/v1/properties",
	rooms: "/v1/rooms",
	roomTypes: "/v1/room-types",
	guests: "/v1/guests",
	reservations: "/v1/reservations",
	availability: "/v1/availability",
	payments: "/v1/billing/payments",
	dashboardStats: "/v1/dashboard/stats",
};

export default {
	GATEWAY_URL,
	API_TOKEN,
	ADMIN_USERNAME,
	ADMIN_PASSWORD,
	TENANT_IDS,
	PROPERTY_IDS,
	ROOM_TYPE_IDS,
	RATE_CODE,
	VUS,
	DURATION,
	RAMP_UP,
	WORKLOAD_RATIOS,
	DEFAULT_THRESHOLDS,
	getHeaders,
	ENDPOINTS,
};
