/**
 * Baseline load test (v2)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import {
	GATEWAY_URL,
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
} from "../lib/config.js";
import {
	uuid,
	randomInt,
	pickRandom,
	futureDate,
	randomEmail,
	randomPhone,
	sleepWithJitter,
	isSuccess,
	parseList,
} from "../lib/utils.js";
import { getToken } from "../lib/auth.js";

const readLatency = new Trend("baseline_read_latency");
const writeLatency = new Trend("baseline_write_latency");
const errorCount = new Counter("baseline_errors");
const successRate = new Rate("baseline_success_rate");

export const options = {
	stages: [
		{ duration: RAMP_UP, target: Math.max(1, Math.floor(VUS / 2)) },
		{ duration: DURATION, target: VUS },
		{ duration: "30s", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		baseline_success_rate: ["rate>0.95"],
		baseline_read_latency: ["p(95)<350"],
		baseline_write_latency: ["p(95)<900"],
	},
};

export default function () {
	const token = getToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	if (!token) return;
	const headers = getHeaders(token);

	const tenantId = pickRandom(TENANT_IDS);
	const propertyId = pickRandom(PROPERTY_IDS);
	const roomTypeId = pickRandom(ROOM_TYPE_IDS);

	const choice = Math.random();
	let cursor = 0;

	if (choice < (cursor += WORKLOAD_RATIOS.availability)) {
		doAvailability(headers, tenantId, propertyId);
	} else if (choice < (cursor += WORKLOAD_RATIOS.reservationCreate)) {
		doReservationCreate(headers, tenantId, propertyId, roomTypeId);
	} else if (choice < (cursor += WORKLOAD_RATIOS.reservationModify)) {
		doReservationModify(headers, tenantId, propertyId);
	} else if (choice < (cursor += WORKLOAD_RATIOS.reservationCancel)) {
		doReservationCancel(headers, tenantId);
	} else if (choice < (cursor += WORKLOAD_RATIOS.otaSync)) {
		doOtaSync(headers, tenantId, propertyId);
	} else if (choice < (cursor += WORKLOAD_RATIOS.checkIn)) {
		doCheckIn(headers, tenantId);
	} else if (choice < (cursor += WORKLOAD_RATIOS.checkOut)) {
		doCheckOut(headers, tenantId);
	} else if (choice < (cursor += WORKLOAD_RATIOS.payment)) {
		doPayment(headers, tenantId, propertyId);
	} else {
		doReporting(headers, tenantId, propertyId);
	}

	sleep(sleepWithJitter(0.4));
}

function doAvailability(headers, tenantId, propertyId) {
	// Derive availability by listing rooms with status=available via the /v1/rooms endpoint
	const response = http.get(
		`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${tenantId}&property_id=${propertyId}&status=available`,
		{ headers, tags: { operation: "rooms.list.available" } },
	);
	track(response, readLatency);
}

function doReservationCreate(headers, tenantId, propertyId, roomTypeId) {
	const guestId = ensureGuest(headers, tenantId);
	if (!guestId) return;

	const payload = {
		property_id: propertyId,
		guest_id: guestId,
		room_type_id: roomTypeId,
		check_in_date: futureDate(10),
		check_out_date: futureDate(12),
		rate_code: RATE_CODE,
		total_amount: randomInt(150, 900),
		currency: "USD",
		source: "DIRECT",
		notes: `loadtest ${uuid().slice(0, 8)}`,
	};

	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.commands}/reservation.create/execute`,
		JSON.stringify({ tenant_id: tenantId, payload }),
		{
			headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `res-create-${uuid()}` },
			tags: { operation: "reservation.create" },
		},
	);
	track(response, writeLatency, response.status === 202);
}

function doReservationModify(headers, tenantId, propertyId) {
	const reservationId = pickReservationId(headers, tenantId);
	if (!reservationId) return;

	const payload = {
		reservation_id: reservationId,
		property_id: propertyId,
		check_out_date: futureDate(13),
	};

	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.commands}/reservation.modify/execute`,
		JSON.stringify({ tenant_id: tenantId, payload }),
		{
			headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `res-mod-${uuid()}` },
			tags: { operation: "reservation.modify" },
		},
	);
	track(response, writeLatency, response.status === 202);
}

function doReservationCancel(headers, tenantId) {
	const reservationId = pickReservationId(headers, tenantId);
	if (!reservationId) return;

	const payload = {
		reservation_id: reservationId,
		reason: "loadtest cancel",
	};

	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.commands}/reservation.cancel/execute`,
		JSON.stringify({ tenant_id: tenantId, payload }),
		{
			headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `res-cancel-${uuid()}` },
			tags: { operation: "reservation.cancel" },
		},
	);
	track(response, writeLatency, response.status === 202);
}

function doCheckIn(headers, tenantId) {
	const reservationId = pickReservationId(headers, tenantId);
	if (!reservationId) return;

	const payload = { reservation_id: reservationId, notes: "loadtest check-in" };
	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.commands}/reservation.check_in/execute`,
		JSON.stringify({ tenant_id: tenantId, payload }),
		{
			headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `checkin-${uuid()}` },
			tags: { operation: "reservation.check_in" },
		},
	);
	track(response, writeLatency, response.status === 202);
}

function doCheckOut(headers, tenantId) {
	const reservationId = pickReservationId(headers, tenantId);
	if (!reservationId) return;

	const payload = { reservation_id: reservationId, notes: "loadtest check-out" };
	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.commands}/reservation.check_out/execute`,
		JSON.stringify({ tenant_id: tenantId, payload }),
		{
			headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `checkout-${uuid()}` },
			tags: { operation: "reservation.check_out" },
		},
	);
	track(response, writeLatency, response.status === 202);
}

function doPayment(headers, tenantId, propertyId) {
	const reservationId = pickReservationId(headers, tenantId);
	if (!reservationId) return;

	const payload = {
		property_id: propertyId,
		reservation_id: reservationId,
		amount: randomInt(20, 200),
		currency: "USD",
		description: "loadtest charge",
	};

	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.commands}/billing.charge.post/execute`,
		JSON.stringify({ tenant_id: tenantId, payload }),
		{
			headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `charge-${uuid()}` },
			tags: { operation: "billing.charge.post" },
		},
	);
	track(response, writeLatency, response.status === 202);
}

function doOtaSync(headers, tenantId, propertyId) {
	const payload = {
		property_id: propertyId,
		ota_code: "BOOKING_COM",
		sync_scope: "availability",
	};

	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.commands}/integration.ota.sync_request/execute`,
		JSON.stringify({ tenant_id: tenantId, payload }),
		{
			headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `ota-sync-${uuid()}` },
			tags: { operation: "integration.ota.sync_request" },
		},
	);
	track(response, writeLatency, response.status === 202);
}

function doReporting(headers, tenantId, propertyId) {
	const response = http.get(
		`${GATEWAY_URL}${ENDPOINTS.dashboardStats}?tenant_id=${tenantId}&property_id=${propertyId}`,
		{ headers, tags: { operation: "reporting" } },
	);
	track(response, readLatency);
}

function ensureGuest(headers, tenantId) {
	const listRes = http.get(
		`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${tenantId}&limit=1`,
		{ headers, tags: { operation: "guest.list" } },
	);

	if (isSuccess(listRes)) {
		const guests = parseList(listRes);
		const guest = guests[0];
		const guestId = guest?.guest_id || guest?.id || null;
		if (guestId) return guestId;
	}

	const guestEmail = randomEmail();
	const payload = {
		first_name: "Load",
		last_name: "Tester",
		email: guestEmail,
		phone: randomPhone(),
		metadata: { source: "loadtest" },
	};

	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.commands}/guest.register/execute`,
		JSON.stringify({ tenant_id: tenantId, payload }),
		{
			headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `guest-${uuid()}` },
			tags: { operation: "guest.register" },
		},
	);

	if (!isSuccess(response) || response.status !== 202) return null;

	// Poll with exponential backoff (0.5s, 1s, 2s, 4s = ~7.5s total) to allow
	// async command processing to complete before giving up.
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const backoff = 0.5 * Math.pow(2, attempt);
		sleep(backoff);
		const lookupRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${tenantId}&email=${encodeURIComponent(guestEmail)}`,
			{ headers, tags: { operation: "guest.lookup" } },
		);
		if (isSuccess(lookupRes)) {
			const guests = parseList(lookupRes);
			const guest = guests[0];
			const guestId = guest?.guest_id || guest?.id || null;
			if (guestId) return guestId;
		}
	}

	return null;
}

function pickReservationId(headers, tenantId) {
	const response = http.get(
		`${GATEWAY_URL}${ENDPOINTS.reservations}?tenant_id=${tenantId}&limit=1`,
		{ headers, tags: { operation: "reservation.list" } },
	);

	if (!isSuccess(response)) return null;
	const reservations = parseList(response);
	const reservation = reservations[0];
	return reservation?.reservation_id || reservation?.id || null;
}

function track(response, trend, explicitSuccess) {
	const ok = explicitSuccess ?? isSuccess(response);
	trend.add(response.timings.duration);
	successRate.add(ok);
	if (!ok) errorCount.add(1);
	check(response, { "status ok": () => ok });
}
