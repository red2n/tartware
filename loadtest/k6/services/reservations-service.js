/**
 * Reservations Service Load Test
 *
 * Tests: Reservations, Waitlist, Availability
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import {
	commandExecute,
	GATEWAY_URL,
	TENANT_IDS,
	PROPERTY_IDS,
	VUS,
	DURATION,
	getHeaders,
	ENDPOINTS,
	DEFAULT_THRESHOLDS,
} from "../lib/config.js";

// This scenario drives one property, so it takes the first of each. It used to
// import TENANT_ID / PROPERTY_ID, which config.js does not export and never
// did: every read below sent `tenant_id=undefined` and every write threw.
const TENANT_ID = TENANT_IDS[0];
const PROPERTY_ID = PROPERTY_IDS[0];
import {
	uuid,
	sleepWithJitter,
	isSuccess,
	pickRandom,
	generateReservation,
	futureDate,
} from "../lib/utils.js";

const reservationsLatency = new Trend("reservations_service_latency");
const reservationsErrors = new Counter("reservations_service_errors");
const reservationsSuccess = new Rate("reservations_service_success_rate");

export const options = {
	stages: [
		{ duration: "30s", target: Math.floor(VUS / 2) },
		{ duration: DURATION, target: VUS },
		{ duration: "30s", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		reservations_service_latency: ["p(95)<600", "p(99)<1200"],
		reservations_service_success_rate: ["rate>0.95"],
	},
};

const headers = getHeaders();

let cachedReservations = [];
let cachedRoomTypes = [];

export function setup() {
	const reservationsRes = http.get(
		`${GATEWAY_URL}${ENDPOINTS.reservations}?tenant_id=${TENANT_ID}&limit=50`,
		{ headers },
	);

	if (reservationsRes.status === 200) {
		try {
			const data = JSON.parse(reservationsRes.body);
			cachedReservations = Array.isArray(data) ? data : data.data || [];
		} catch (e) {
			cachedReservations = [];
		}
	}

	const roomTypesRes = http.get(
		`${GATEWAY_URL}${ENDPOINTS.roomTypes}?tenant_id=${TENANT_ID}`,
		{ headers },
	);

	if (roomTypesRes.status === 200) {
		try {
			const data = JSON.parse(roomTypesRes.body);
			cachedRoomTypes = Array.isArray(data) ? data : data.data || [];
		} catch (e) {
			cachedRoomTypes = [];
		}
	}

	return { reservations: cachedReservations, roomTypes: cachedRoomTypes };
}

export default function (data) {
	const { reservations, roomTypes } = data || {
		reservations: [],
		roomTypes: [],
	};
	const selector = Math.random();

	if (selector < 0.25) {
		testListReservations();
	} else if (selector < 0.4) {
		testFilteredReservations();
	} else if (selector < 0.55) {
		testGetReservation(reservations);
	} else if (selector < 0.7) {
		testAvailability(roomTypes);
	} else if (selector < 0.85) {
		testWaitlist();
	} else {
		testCreateReservation(roomTypes);
	}

	sleep(sleepWithJitter(0.3));
}

function testListReservations() {
	group("Reservations - List Reservations", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.reservations}?tenant_id=${TENANT_ID}&limit=50`,
			{
				headers,
				tags: { service: "reservations", endpoint: "reservations-list" },
			},
		);

		recordMetrics(response, "reservations-list");
	});
}

function testFilteredReservations() {
	group("Reservations - Filtered Reservations", () => {
		const statuses = ["CONFIRMED", "CHECKED_IN", "PENDING", "CANCELLED"];
		const status = pickRandom(statuses);

		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.reservations}?tenant_id=${TENANT_ID}&status=${status}&limit=25`,
			{
				headers,
				tags: { service: "reservations", endpoint: "reservations-filtered" },
			},
		);

		recordMetrics(response, "reservations-filtered");
	});
}

function testGetReservation(reservations) {
	if (!reservations || reservations.length === 0) {
		testListReservations();
		return;
	}

	group("Reservations - Get Reservation by ID", () => {
		const reservation = pickRandom(reservations);
		const reservationId = reservation.reservation_id || reservation.id;

		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.reservations}/${reservationId}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "reservations", endpoint: "reservation-get" } },
		);

		recordMetrics(response, "reservation-get");
	});
}

function testAvailability(roomTypes) {
	group("Reservations - Check Availability", () => {
		const checkIn = futureDate(7);
		const checkOut = futureDate(10);

		let url = `${GATEWAY_URL}${ENDPOINTS.availability}?tenant_id=${TENANT_ID}&property_id=${PROPERTY_ID}&check_in=${checkIn}&check_out=${checkOut}`;

		if (roomTypes && roomTypes.length > 0) {
			const roomType = pickRandom(roomTypes);
			const typeId = roomType.room_type_id || roomType.id;
			url += `&room_type_id=${typeId}`;
		}

		const response = http.get(url, {
			headers,
			tags: { service: "reservations", endpoint: "availability-check" },
		});

		recordMetrics(response, "availability-check");
	});
}

function testWaitlist() {
	group("Reservations - Waitlist", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.waitlist}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "reservations", endpoint: "waitlist" } },
		);

		recordMetrics(response, "waitlist");
	});
}

function testCreateReservation(roomTypes) {
	group("Reservations - Create Reservation", () => {
		const roomTypeId =
			roomTypes && roomTypes.length > 0
				? roomTypes[0].room_type_id || roomTypes[0].id
				: uuid();

		const reservationData = generateReservation(
			TENANT_ID,
			PROPERTY_ID,
			roomTypeId,
		);

		// `/v1/reservations` is GET only; a booking is a command.
		const response = http.post(
			`${GATEWAY_URL}${commandExecute("reservation.create")}`,
			JSON.stringify(reservationData),
			{
				headers,
				tags: { service: "reservations", endpoint: "reservation-create" },
			},
		);

		// A command is accepted, not created: 202 is the only success here.
		const success = response.status === 202;

		reservationsLatency.add(response.timings.duration);
		reservationsSuccess.add(success);

		if (!success) {
			reservationsErrors.add(1);
		}

		check(
			response,
			{
				"command accepted (202)": (r) => r.status === 202,
			},
			{ endpoint: "reservation-create" },
		);
	});
}

function recordMetrics(response, endpoint) {
	const success = isSuccess(response);

	reservationsLatency.add(response.timings.duration);
	reservationsSuccess.add(success);

	if (!success) {
		reservationsErrors.add(1);
	}

	check(
		response,
		{
			[`${endpoint} status ok`]: (r) => isSuccess(r),
		},
		{ endpoint },
	);
}

export function handleSummary(data) {
	return {
		stdout: `
╔════════════════════════════════════════════════════════════╗
║           RESERVATIONS SERVICE TEST SUMMARY                 ║
╠════════════════════════════════════════════════════════════╣
║  Success Rate: ${((data.metrics.reservations_service_success_rate?.values.rate || 0) * 100).toFixed(1)}%
║  p95 Latency: ${data.metrics.reservations_service_latency?.values["p(95)"]?.toFixed(0) || "N/A"}ms
║  Error Count: ${data.metrics.reservations_service_errors?.values.count || 0}
║  Total Requests: ${data.metrics.http_reqs?.values.count || 0}
╚════════════════════════════════════════════════════════════╝
`,
	};
}
