/**
 * Smoke Test - Quick sanity check for all services
 *
 * Purpose: Verify all endpoints are reachable and functioning
 * Duration: ~1 minute
 * VUs: 1-5
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import {
	GATEWAY_URL,
	TENANT_ID,
	PROPERTY_ID,
	getHeaders,
	ENDPOINTS,
} from "../lib/config.js";
import { futureDate, pickRandom } from "../lib/utils.js";

const smokeLatency = new Trend("smoke_latency");

export const options = {
	stages: [
		{ duration: "10s", target: 1 }, // warm up
		{ duration: "30s", target: 3 }, // light load
		{ duration: "10s", target: 5 }, // small increase
		{ duration: "10s", target: 0 }, // cool down
	],
	thresholds: {
		http_req_failed: ["rate<0.05"], // <5% errors for smoke
		http_req_duration: ["p(95)<2000"], // p95 < 2s (relaxed for smoke)
		checks: ["rate>0.90"], // >90% checks pass
	},
};

const headers = getHeaders();

export default function () {
	// Health check
	testEndpoint("health", `${GATEWAY_URL}/health`, null);

	// Core Service endpoints
	testEndpoint(
		"properties",
		`${GATEWAY_URL}${ENDPOINTS.properties}?tenant_id=${TENANT_ID}`,
		headers,
	);

	// Rooms Service endpoints
	testEndpoint(
		"rooms",
		`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}`,
		headers,
	);
	testEndpoint(
		"room-types",
		`${GATEWAY_URL}${ENDPOINTS.roomTypes}?tenant_id=${TENANT_ID}`,
		headers,
	);

	// Guests Service endpoints
	testEndpoint(
		"guests",
		`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${TENANT_ID}`,
		headers,
	);

	// Billing Service endpoints
	testEndpoint(
		"payments",
		`${GATEWAY_URL}${ENDPOINTS.payments}?tenant_id=${TENANT_ID}`,
		headers,
	);
	testEndpoint(
		"invoices",
		`${GATEWAY_URL}${ENDPOINTS.invoices}?tenant_id=${TENANT_ID}`,
		headers,
	);

	// Housekeeping Service endpoints
	testEndpoint(
		"housekeeping-tasks",
		`${GATEWAY_URL}${ENDPOINTS.housekeepingTasks}?tenant_id=${TENANT_ID}`,
		headers,
	);

	// Booking Config endpoints
	testEndpoint(
		"booking-sources",
		`${GATEWAY_URL}${ENDPOINTS.bookingSources}?tenant_id=${TENANT_ID}`,
		headers,
	);
	testEndpoint(
		"market-segments",
		`${GATEWAY_URL}${ENDPOINTS.marketSegments}?tenant_id=${TENANT_ID}`,
		headers,
	);

	// Settings endpoints
	testEndpoint(
		"rates",
		`${GATEWAY_URL}${ENDPOINTS.rates}?tenant_id=${TENANT_ID}&property_id=${PROPERTY_ID}`,
		headers,
	);

	// Recommendations endpoints
	testRecommendations();

	sleep(1);
}

function testRecommendations() {
	const checkInDate = futureDate(7);
	const checkOutDate = futureDate(9);

	testEndpoint(
		"recommendations",
		`${GATEWAY_URL}${ENDPOINTS.recommendations}?propertyId=${PROPERTY_ID}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=2&children=0&limit=5`,
		headers,
	);

	const roomsRes = http.get(
		`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=10`,
		{ headers },
	);

	if (roomsRes.status >= 200 && roomsRes.status < 300) {
		try {
			const body = roomsRes.json();
			const rooms = Array.isArray(body) ? body : body.data || [];
			const room = pickRandom(rooms);
			const roomId = room?.room_id || room?.id;

			if (roomId) {
				const rankBody = {
					propertyId: PROPERTY_ID,
					checkInDate,
					checkOutDate,
					adults: 2,
					children: 0,
					roomIds: [roomId],
				};

				const rankRes = http.post(
					`${GATEWAY_URL}${ENDPOINTS.recommendationsRank}`,
					JSON.stringify(rankBody),
					{ headers, tags: { name: "smoke_recommendations_rank" } },
				);

				smokeLatency.add(rankRes.timings.duration);
				check(rankRes, {
					"recommendations rank ok": (r) => r.status >= 200 && r.status < 300,
				});
			}
		} catch {
			// ignore parsing errors in smoke mode
		}
	}
}

function testEndpoint(name, url, requestHeaders) {
	const response = http.get(url, {
		headers: requestHeaders || {},
		tags: { name: `smoke_${name}` },
	});

	smokeLatency.add(response.timings.duration);

	const success = check(
		response,
		{
			[`${name} status ok`]: (r) => r.status >= 200 && r.status < 300,
			[`${name} has body`]: (r) => r.body && r.body.length > 0,
		},
		{ endpoint: name },
	);

	if (!success) {
		console.warn(`${name} failed: ${response.status} - ${response.body}`);
	}

	sleep(0.2);
}

export function handleSummary(data) {
	const passed = data.metrics.checks.values.passes || 0;
	const failed = data.metrics.checks.values.fails || 0;
	const total = passed + failed;

	return {
		stdout: `
╔════════════════════════════════════════════════════════════╗
║                    SMOKE TEST SUMMARY                       ║
╠════════════════════════════════════════════════════════════╣
║  Checks: ${passed}/${total} passed (${((passed / total) * 100).toFixed(1)}%)
║  HTTP Errors: ${((data.metrics.http_req_failed.values.rate || 0) * 100).toFixed(2)}%
║  p95 Latency: ${(data.metrics.http_req_duration.values["p(95)"] || 0).toFixed(0)}ms
╚════════════════════════════════════════════════════════════╝
`,
	};
}
