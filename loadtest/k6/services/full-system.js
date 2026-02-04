/**
 * Full System Load Test
 *
 * Comprehensive test that exercises all microservices
 * This simulates realistic user journey across the entire platform
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import {
	GATEWAY_URL,
	TENANT_ID,
	PROPERTY_ID,
	VUS,
	DURATION,
	getHeaders,
	ENDPOINTS,
	DEFAULT_THRESHOLDS,
} from "../lib/config.js";
import {
	sleepWithJitter,
	isSuccess,
	pickRandom,
	futureDate,
} from "../lib/utils.js";

// Metrics per service
const coreLatency = new Trend("core_service_latency");
const roomsLatency = new Trend("rooms_service_latency");
const guestsLatency = new Trend("guests_service_latency");
const reservationsLatency = new Trend("reservations_service_latency");
const billingLatency = new Trend("billing_service_latency");
const housekeepingLatency = new Trend("housekeeping_service_latency");
const settingsLatency = new Trend("settings_service_latency");
const recommendationsLatency = new Trend("recommendations_service_latency");

const totalErrors = new Counter("total_errors");
const totalSuccess = new Rate("total_success_rate");

export const options = {
	stages: [
		{ duration: "1m", target: Math.floor(VUS / 2) },
		{ duration: DURATION, target: VUS },
		{ duration: "1m", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		total_success_rate: ["rate>0.95"],
		core_service_latency: ["p(95)<300"],
		rooms_service_latency: ["p(95)<300"],
		guests_service_latency: ["p(95)<400"],
		reservations_service_latency: ["p(95)<600"],
		billing_service_latency: ["p(95)<500"],
		housekeeping_service_latency: ["p(95)<500"],
		settings_service_latency: ["p(95)<250"],
		recommendations_service_latency: ["p(95)<600"],
	},
};

const headers = getHeaders();

export function setup() {
	console.log("Setting up full system test...");
	console.log(`Gateway URL: ${GATEWAY_URL}`);
	console.log(`Tenant ID: ${TENANT_ID}`);
	console.log(`Property ID: ${PROPERTY_ID}`);

	// Pre-fetch reference data
	const roomTypesRes = http.get(
		`${GATEWAY_URL}${ENDPOINTS.roomTypes}?tenant_id=${TENANT_ID}`,
		{ headers },
	);

	let roomTypes = [];
	if (roomTypesRes.status === 200) {
		try {
			const data = JSON.parse(roomTypesRes.body);
			roomTypes = Array.isArray(data) ? data : data.data || [];
		} catch (e) {
			roomTypes = [];
		}
	}

	const guestsRes = http.get(
		`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${TENANT_ID}&limit=20`,
		{ headers },
	);

	let guests = [];
	if (guestsRes.status === 200) {
		try {
			const data = JSON.parse(guestsRes.body);
			guests = Array.isArray(data) ? data : data.data || [];
		} catch (e) {
			guests = [];
		}
	}

	return { roomTypes, guests };
}

export default function (data) {
	const { roomTypes, guests } = data || { roomTypes: [], guests: [] };

	// Randomly select a user journey
	const journeySelector = Math.random();

	if (journeySelector < 0.2) {
		browseRoomsJourney();
	} else if (journeySelector < 0.35) {
		checkAvailabilityJourney(roomTypes);
	} else if (journeySelector < 0.5) {
		guestManagementJourney(guests);
	} else if (journeySelector < 0.65) {
		reservationJourney(roomTypes, guests);
	} else if (journeySelector < 0.75) {
		billingJourney();
	} else if (journeySelector < 0.85) {
		housekeepingJourney();
	} else if (journeySelector < 0.92) {
		settingsJourney();
	} else if (journeySelector < 0.97) {
		recommendationsJourney();
	} else {
		adminJourney();
	}

	sleep(sleepWithJitter(0.5));
}

function browseRoomsJourney() {
	group("Journey - Browse Rooms", () => {
		// 1. Get properties
		const propertiesRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.properties}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", journey: "browse-rooms" } },
		);
		recordMetric(propertiesRes, coreLatency, "properties");

		sleep(0.2);

		// 2. Get room types
		const roomTypesRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.roomTypes}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "rooms", journey: "browse-rooms" } },
		);
		recordMetric(roomTypesRes, roomsLatency, "room-types");

		sleep(0.2);

		// 3. Get available rooms
		const roomsRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&property_id=${PROPERTY_ID}`,
			{ headers, tags: { service: "rooms", journey: "browse-rooms" } },
		);
		recordMetric(roomsRes, roomsLatency, "rooms");
	});
}

function checkAvailabilityJourney(roomTypes) {
	group("Journey - Check Availability", () => {
		const checkIn = futureDate(7);
		const checkOut = futureDate(10);

		// 1. Check general availability
		let availUrl = `${GATEWAY_URL}${ENDPOINTS.availability}?tenant_id=${TENANT_ID}&property_id=${PROPERTY_ID}&check_in=${checkIn}&check_out=${checkOut}`;

		const availRes = http.get(availUrl, {
			headers,
			tags: { service: "reservations", journey: "availability" },
		});
		recordMetric(availRes, reservationsLatency, "availability");

		sleep(0.3);

		// 2. Get rate plans
		const ratesRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.ratePlans}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", journey: "availability" } },
		);
		recordMetric(ratesRes, settingsLatency, "rate-plans");
	});
}

function guestManagementJourney(guests) {
	group("Journey - Guest Management", () => {
		// 1. List guests
		const listRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "guests", journey: "guest-mgmt" } },
		);
		recordMetric(listRes, guestsLatency, "guests-list");

		sleep(0.2);

		// 2. Get guest details if available
		if (guests && guests.length > 0) {
			const guest = pickRandom(guests);
			const guestId = guest.guest_id || guest.id;

			const detailRes = http.get(
				`${GATEWAY_URL}${ENDPOINTS.guests}/${guestId}?tenant_id=${TENANT_ID}`,
				{ headers, tags: { service: "guests", journey: "guest-mgmt" } },
			);
			recordMetric(detailRes, guestsLatency, "guest-detail");
		}

		sleep(0.2);

		// 3. Search guests
		const searchRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${TENANT_ID}&search=test&limit=10`,
			{ headers, tags: { service: "guests", journey: "guest-mgmt" } },
		);
		recordMetric(searchRes, guestsLatency, "guests-search");
	});
}

function reservationJourney(roomTypes, guests) {
	group("Journey - Reservation Flow", () => {
		// 1. Check availability
		const checkIn = futureDate(14);
		const checkOut = futureDate(17);

		const availRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.availability}?tenant_id=${TENANT_ID}&property_id=${PROPERTY_ID}&check_in=${checkIn}&check_out=${checkOut}`,
			{ headers, tags: { service: "reservations", journey: "reservation" } },
		);
		recordMetric(availRes, reservationsLatency, "availability-check");

		sleep(0.3);

		// 2. List existing reservations
		const listRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.reservations}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "reservations", journey: "reservation" } },
		);
		recordMetric(listRes, reservationsLatency, "reservations-list");

		sleep(0.2);

		// 3. Get packages (optional add-ons)
		const packagesRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.packages}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", journey: "reservation" } },
		);
		recordMetric(packagesRes, settingsLatency, "packages");
	});
}

function billingJourney() {
	group("Journey - Billing Operations", () => {
		// 1. List invoices
		const invoicesRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.invoices}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "billing", journey: "billing" } },
		);
		recordMetric(invoicesRes, billingLatency, "invoices-list");

		sleep(0.2);

		// 2. List payments
		const paymentsRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.payments}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "billing", journey: "billing" } },
		);
		recordMetric(paymentsRes, billingLatency, "payments-list");

		sleep(0.2);

		// 3. List folios
		const foliosRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.folios}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "billing", journey: "billing" } },
		);
		recordMetric(foliosRes, billingLatency, "folios-list");
	});
}

function housekeepingJourney() {
	group("Journey - Housekeeping", () => {
		// 1. List tasks
		const tasksRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.housekeepingTasks}?tenant_id=${TENANT_ID}&limit=30`,
			{ headers, tags: { service: "housekeeping", journey: "housekeeping" } },
		);
		recordMetric(tasksRes, housekeepingLatency, "tasks-list");

		sleep(0.2);

		// 2. Filter by status
		const pendingRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.housekeepingTasks}?tenant_id=${TENANT_ID}&status=PENDING`,
			{ headers, tags: { service: "housekeeping", journey: "housekeeping" } },
		);
		recordMetric(pendingRes, housekeepingLatency, "tasks-pending");

		sleep(0.2);

		// 3. Maintenance requests
		const maintenanceRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.maintenanceRequests}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "housekeeping", journey: "housekeeping" } },
		);
		recordMetric(maintenanceRes, housekeepingLatency, "maintenance-list");
	});
}

function settingsJourney() {
	group("Journey - Settings", () => {
		// 1. Rate plans
		const ratePlansRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.ratePlans}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", journey: "settings" } },
		);
		recordMetric(ratePlansRes, settingsLatency, "rate-plans");

		sleep(0.2);

		// 2. Policies
		const policiesRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.cancellationPolicies}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", journey: "settings" } },
		);
		recordMetric(policiesRes, settingsLatency, "cancellation-policies");

		sleep(0.2);

		// 3. Seasons
		const seasonsRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.seasons}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", journey: "settings" } },
		);
		recordMetric(seasonsRes, settingsLatency, "seasons");
	});
}

function adminJourney() {
	group("Journey - Admin", () => {
		// 1. Properties
		const propertiesRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.properties}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", journey: "admin" } },
		);
		recordMetric(propertiesRes, coreLatency, "properties");

		sleep(0.2);

		// 2. Booking sources
		const sourcesRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.bookingSources}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", journey: "admin" } },
		);
		recordMetric(sourcesRes, coreLatency, "booking-sources");

		sleep(0.2);

		// 3. Market segments
		const segmentsRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.marketSegments}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", journey: "admin" } },
		);
		recordMetric(segmentsRes, coreLatency, "market-segments");
	});
}

function recommendationsJourney() {
	group("Journey - Recommendations", () => {
		const checkInDate = futureDate(7);
		const checkOutDate = futureDate(10);

		const recommendationsRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.recommendations}?propertyId=${PROPERTY_ID}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=2&children=0&limit=5`,
			{ headers, tags: { service: "recommendations", journey: "recommendations" } },
		);
		recordMetric(recommendationsRes, recommendationsLatency, "recommendations");

		let roomId = null;
		try {
			const body = recommendationsRes.json();
			const rooms = Array.isArray(body)
				? body
				: body.data || body.rooms || [];
			const room = pickRandom(rooms);
			roomId = room?.roomId || room?.room_id || room?.id;
		} catch {
			// ignore parsing errors
		}

		if (!roomId) {
			const roomsRes = http.get(
				`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=5`,
				{ headers, tags: { service: "rooms", journey: "recommendations" } },
			);
			if (roomsRes.status >= 200 && roomsRes.status < 300) {
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
				{ headers, tags: { service: "recommendations", journey: "recommendations" } },
			);
			recordMetric(rankRes, recommendationsLatency, "recommendations-rank");
		}
	});
}

function recordMetric(response, latencyMetric, endpoint) {
	const success = isSuccess(response);

	latencyMetric.add(response.timings.duration);
	totalSuccess.add(success);

	if (!success) {
		totalErrors.add(1);
	}

	check(
		response,
		{
			[`${endpoint} ok`]: (r) => isSuccess(r),
		},
		{ endpoint },
	);
}

export function handleSummary(data) {
	const metrics = data.metrics;

	return {
		stdout: `
╔══════════════════════════════════════════════════════════════════════════════╗
║                         FULL SYSTEM TEST SUMMARY                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Overall Success Rate: ${((metrics.total_success_rate?.values.rate || 0) * 100).toFixed(1)}%
║  Total Errors: ${metrics.total_errors?.values.count || 0}
║  Total Requests: ${metrics.http_reqs?.values.count || 0}
╠──────────────────────────────────────────────────────────────────────────────╣
║  SERVICE LATENCIES (p95)                                                      ║
╠──────────────────────────────────────────────────────────────────────────────╣
║  Core Service:         ${(metrics.core_service_latency?.values["p(95)"] || 0).toFixed(0)}ms
║  Rooms Service:        ${(metrics.rooms_service_latency?.values["p(95)"] || 0).toFixed(0)}ms
║  Guests Service:       ${(metrics.guests_service_latency?.values["p(95)"] || 0).toFixed(0)}ms
║  Reservations Service: ${(metrics.reservations_service_latency?.values["p(95)"] || 0).toFixed(0)}ms
║  Billing Service:      ${(metrics.billing_service_latency?.values["p(95)"] || 0).toFixed(0)}ms
║  Housekeeping Service: ${(metrics.housekeeping_service_latency?.values["p(95)"] || 0).toFixed(0)}ms
║  Settings Service:     ${(metrics.settings_service_latency?.values["p(95)"] || 0).toFixed(0)}ms
║  Recommendations:      ${(metrics.recommendations_service_latency?.values["p(95)"] || 0).toFixed(0)}ms
╚══════════════════════════════════════════════════════════════════════════════╝
`,
	};
}
