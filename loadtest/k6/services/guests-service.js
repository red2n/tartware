/**
 * Guests Service Load Test
 *
 * Tests: Guest profiles, Preferences, Documents, Communications
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import {
	GATEWAY_URL,
	TENANT_ID,
	VUS,
	DURATION,
	getHeaders,
	ENDPOINTS,
	DEFAULT_THRESHOLDS,
} from "../lib/config.js";
import { uuid, generateGuest, sleepWithJitter, isSuccess } from "../lib/utils.js";

const guestsLatency = new Trend("guests_service_latency");
const guestsErrors = new Counter("guests_service_errors");
const guestsSuccess = new Rate("guests_service_success_rate");

export const options = {
	stages: [
		{ duration: "30s", target: Math.floor(VUS / 2) },
		{ duration: DURATION, target: VUS },
		{ duration: "30s", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		guests_service_latency: ["p(95)<400", "p(99)<800"],
		guests_service_success_rate: ["rate>0.95"],
	},
};

const headers = getHeaders();

export default function () {
	const selector = Math.random();

	if (selector < 0.35) {
		testListGuests();
	} else if (selector < 0.5) {
		testSearchGuests();
	} else if (selector < 0.65) {
		testGuestPreferences();
	} else if (selector < 0.75) {
		testGuestCommunications();
	} else {
		testCreateGuest();
	}

	sleep(sleepWithJitter(0.3));
}

function testListGuests() {
	group("Guests - List", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "guests", endpoint: "guests-list" } },
		);

		recordMetrics(response, "guests-list");
	});
}

function testSearchGuests() {
	group("Guests - Search", () => {
		const searchTerms = ["john", "smith", "test", "load"];
		const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${TENANT_ID}&search=${term}&limit=10`,
			{ headers, tags: { service: "guests", endpoint: "guests-search" } },
		);

		recordMetrics(response, "guests-search");
	});
}

function testGuestPreferences() {
	group("Guests - Preferences", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.guestPreferences}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "guests", endpoint: "guest-preferences" } },
		);

		recordMetrics(response, "guest-preferences");
	});
}

function testGuestCommunications() {
	group("Guests - Communications", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.guestCommunications}?tenant_id=${TENANT_ID}&limit=20`,
			{
				headers,
				tags: { service: "guests", endpoint: "guest-communications" },
			},
		);

		recordMetrics(response, "guest-communications");
	});
}

function testCreateGuest() {
	group("Guests - Create", () => {
		const guestData = generateGuest(TENANT_ID);

		const response = http.post(
			`${GATEWAY_URL}${ENDPOINTS.guests}`,
			JSON.stringify(guestData),
			{ headers, tags: { service: "guests", endpoint: "guests-create" } },
		);

		const success =
			response.status === 201 ||
			response.status === 200 ||
			response.status === 202;

		guestsLatency.add(response.timings.duration);
		guestsSuccess.add(success);

		if (!success) {
			guestsErrors.add(1);
		}

		check(
			response,
			{
				"guest created": (r) =>
					r.status === 201 || r.status === 200 || r.status === 202,
			},
			{ endpoint: "guests-create" },
		);
	});
}

function recordMetrics(response, endpoint) {
	const success = isSuccess(response);

	guestsLatency.add(response.timings.duration);
	guestsSuccess.add(success);

	if (!success) {
		guestsErrors.add(1);
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
║              GUESTS SERVICE TEST SUMMARY                    ║
╠════════════════════════════════════════════════════════════╣
║  Success Rate: ${((data.metrics.guests_service_success_rate?.values.rate || 0) * 100).toFixed(1)}%
║  p95 Latency: ${data.metrics.guests_service_latency?.values["p(95)"]?.toFixed(0) || "N/A"}ms
║  Error Count: ${data.metrics.guests_service_errors?.values.count || 0}
║  Total Requests: ${data.metrics.http_reqs?.values.count || 0}
╚════════════════════════════════════════════════════════════╝
`,
	};
}
