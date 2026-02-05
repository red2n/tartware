/**
 * Load Test - Sustained normal traffic simulation
 *
 * Purpose: Test system behavior under expected production load
 * Duration: ~10 minutes
 * VUs: 50-100 (configurable)
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import {
	GATEWAY_URL,
	TENANT_ID,
	PROPERTY_ID,
	ROOM_TYPE_ID,
	VUS,
	DURATION,
	RAMP_UP,
	getHeaders,
	ENDPOINTS,
	DEFAULT_THRESHOLDS,
} from "../lib/config.js";
import {
	generateGuest,
	generateReservation,
	generatePayment,
	futureDate,
	pickRandom,
	sleepWithJitter,
	isSuccess,
} from "../lib/utils.js";

// Custom metrics
const readLatency = new Trend("read_operations_latency");
const writeLatency = new Trend("write_operations_latency");
const readErrors = new Counter("read_operations_errors");
const writeErrors = new Counter("write_operations_errors");
const successRate = new Rate("operations_success_rate");

export const options = {
	stages: [
		{ duration: RAMP_UP, target: Math.floor(VUS / 2) }, // ramp up
		{ duration: "1m", target: VUS }, // ramp to full
		{ duration: DURATION, target: VUS }, // sustained load
		{ duration: "1m", target: Math.floor(VUS / 2) }, // scale down
		{ duration: "30s", target: 0 }, // cool down
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		read_operations_latency: ["p(95)<300", "p(99)<500"],
		write_operations_latency: ["p(95)<800", "p(99)<1500"],
		operations_success_rate: ["rate>0.95"],
	},
};

const headers = getHeaders();

export default function () {
	// Distribute load across different operation types
	// 70% reads, 30% writes (typical PMS workload)
	const selector = Math.random();

	if (selector < 0.18) {
		readRooms();
	} else if (selector < 0.33) {
		readGuests();
	} else if (selector < 0.48) {
		readReservations();
	} else if (selector < 0.58) {
		readBilling();
	} else if (selector < 0.68) {
		readBookingConfig();
	} else if (selector < 0.78) {
		readRecommendations();
	} else if (selector < 0.88) {
		createGuest();
	} else if (selector < 0.95) {
		createReservation();
	} else {
		createPayment();
	}

	sleep(sleepWithJitter(0.5));
}

// Read Operations

function readRooms() {
	group("Read Rooms", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { operation: "read", service: "rooms" } },
		);

		const success = check(response, {
			"rooms list ok": (r) => isSuccess(r),
			"rooms is array": (r) => {
				try {
					return Array.isArray(r.json());
				} catch {
					return false;
				}
			},
		});

		readLatency.add(response.timings.duration);
		successRate.add(success);
		if (!success) readErrors.add(1);
	});
}

function readGuests() {
	group("Read Guests", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { operation: "read", service: "guests" } },
		);

		const success = check(response, {
			"guests list ok": (r) => isSuccess(r),
		});

		readLatency.add(response.timings.duration);
		successRate.add(success);
		if (!success) readErrors.add(1);
	});
}

function readReservations() {
	group("Read Reservations", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.reservations}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { operation: "read", service: "reservations" } },
		);

		const success = check(response, {
			"reservations list ok": (r) => isSuccess(r),
		});

		readLatency.add(response.timings.duration);
		successRate.add(success);
		if (!success) readErrors.add(1);
	});
}

function readBilling() {
	group("Read Billing", () => {
		// Payments
		const paymentsRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.payments}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { operation: "read", service: "billing" } },
		);

		const success = check(paymentsRes, {
			"payments list ok": (r) => isSuccess(r),
		});

		readLatency.add(paymentsRes.timings.duration);
		successRate.add(success);
		if (!success) readErrors.add(1);
	});
}

function readBookingConfig() {
	group("Read Booking Config", () => {
		const endpoints = [
			ENDPOINTS.bookingSources,
			ENDPOINTS.marketSegments,
			ENDPOINTS.allotments,
		];
		const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

		const response = http.get(
			`${GATEWAY_URL}${endpoint}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { operation: "read", service: "booking-config" } },
		);

		const success = check(response, {
			"booking config ok": (r) => isSuccess(r),
		});

		readLatency.add(response.timings.duration);
		successRate.add(success);
		if (!success) readErrors.add(1);
	});
}

function readRecommendations() {
	group("Read Recommendations", () => {
		const checkInDate = futureDate(7);
		const checkOutDate = futureDate(9);
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.recommendations}?propertyId=${PROPERTY_ID}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=2&children=0&limit=5`,
			{ headers, tags: { operation: "read", service: "recommendations" } },
		);

		const success = check(response, {
			"recommendations ok": (r) => isSuccess(r),
		});

		readLatency.add(response.timings.duration);
		successRate.add(success);
		if (!success) readErrors.add(1);

		let roomId = null;
		try {
			const body = response.json();
			const rooms = Array.isArray(body)
				? body
				: body.data || body.rooms || [];
			const room = pickRandom(rooms);
			roomId = room?.roomId || room?.room_id || room?.id;
		} catch {
			// ignore parsing errors for load test
		}

		if (!roomId) {
			const roomsRes = http.get(
				`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=5`,
				{ headers, tags: { operation: "read", service: "rooms" } },
			);
			if (isSuccess(roomsRes)) {
				try {
					const body = roomsRes.json();
					const rooms = Array.isArray(body) ? body : body.data || [];
					const room = pickRandom(rooms);
					roomId = room?.room_id || room?.id;
				} catch {
					// ignore
				}
			}
		}

		if (roomId) {
			const rankRes = http.post(
				`${GATEWAY_URL}${ENDPOINTS.recommendationsRank}`,
				JSON.stringify({
					propertyId: PROPERTY_ID,
					checkInDate,
					checkOutDate,
					adults: 2,
					children: 0,
					roomIds: [roomId],
				}),
				{ headers, tags: { operation: "read", service: "recommendations" } },
			);

			const rankSuccess = check(rankRes, {
				"recommendations rank ok": (r) => isSuccess(r),
			});

			readLatency.add(rankRes.timings.duration);
			successRate.add(rankSuccess);
			if (!rankSuccess) readErrors.add(1);
		}
	});
}

// Write Operations

function createGuest() {
	group("Create Guest", () => {
		const guestData = generateGuest(TENANT_ID);

		const response = http.post(
			`${GATEWAY_URL}${ENDPOINTS.guests}`,
			JSON.stringify(guestData),
			{ headers, tags: { operation: "write", service: "guests" } },
		);

		const success = check(response, {
			"guest created": (r) => r.status === 201 || r.status === 200,
		});

		writeLatency.add(response.timings.duration);
		successRate.add(success);
		if (!success) writeErrors.add(1);
	});
}

function createReservation() {
	group("Create Reservation", () => {
		const reservationData = generateReservation(
			TENANT_ID,
			PROPERTY_ID,
			ROOM_TYPE_ID,
		);

		const response = http.post(
			`${GATEWAY_URL}${ENDPOINTS.reservations}`,
			JSON.stringify(reservationData),
			{ headers, tags: { operation: "write", service: "reservations" } },
		);

		const success = check(response, {
			"reservation created": (r) =>
				r.status === 201 || r.status === 200 || r.status === 202,
		});

		writeLatency.add(response.timings.duration);
		successRate.add(success);
		if (!success) writeErrors.add(1);
	});
}

function createPayment() {
	group("Create Payment", () => {
		const paymentData = generatePayment(TENANT_ID, PROPERTY_ID);

		const response = http.post(
			`${GATEWAY_URL}${ENDPOINTS.payments}`,
			JSON.stringify(paymentData),
			{ headers, tags: { operation: "write", service: "billing" } },
		);

		const success = check(response, {
			"payment created": (r) =>
				r.status === 201 || r.status === 200 || r.status === 202,
		});

		writeLatency.add(response.timings.duration);
		successRate.add(success);
		if (!success) writeErrors.add(1);
	});
}

export function handleSummary(data) {
	const readP95 =
		data.metrics.read_operations_latency?.values["p(95)"]?.toFixed(0) || "N/A";
	const writeP95 =
		data.metrics.write_operations_latency?.values["p(95)"]?.toFixed(0) || "N/A";
	const successPct =
		((data.metrics.operations_success_rate?.values.rate || 0) * 100).toFixed(
			1,
		) || "N/A";

	return {
		stdout: `
╔════════════════════════════════════════════════════════════╗
║                    LOAD TEST SUMMARY                        ║
╠════════════════════════════════════════════════════════════╣
║  Duration: ${DURATION}
║  Peak VUs: ${VUS}
║  Success Rate: ${successPct}%
║  Read p95: ${readP95}ms
║  Write p95: ${writeP95}ms
║  Total Requests: ${data.metrics.http_reqs?.values.count || 0}
║  Error Rate: ${((data.metrics.http_req_failed?.values.rate || 0) * 100).toFixed(2)}%
╚════════════════════════════════════════════════════════════╝
`,
	};
}
