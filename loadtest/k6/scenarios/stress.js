/**
 * Stress Test - Find system breaking points
 *
 * Purpose: Determine maximum capacity and identify bottlenecks
 * Duration: ~15 minutes
 * VUs: Ramping from 50 to 500
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate, Gauge } from "k6/metrics";
import {
	GATEWAY_URL,
	TENANT_ID,
	PROPERTY_ID,
	ROOM_TYPE_ID,
	getHeaders,
	ENDPOINTS,
} from "../lib/config.js";
import {
	uuid,
	generateGuest,
	generateReservation,
	generatePayment,
	generateHousekeepingTask,
	sleepWithJitter,
	isSuccess,
} from "../lib/utils.js";

// Custom metrics for stress testing
const responseLatency = new Trend("stress_response_latency");
const errorCount = new Counter("stress_errors");
const successRate = new Rate("stress_success_rate");
const activeVUs = new Gauge("stress_active_vus");
const throughput = new Counter("stress_throughput");

// Breaking point detection
let maxSuccessfulVUs = 0;
let breakingPointVUs = 0;

export const options = {
	stages: [
		// Gradual ramp-up to find breaking point
		{ duration: "1m", target: 50 }, // baseline
		{ duration: "2m", target: 100 }, // moderate
		{ duration: "2m", target: 200 }, // heavy
		{ duration: "2m", target: 300 }, // very heavy
		{ duration: "2m", target: 400 }, // extreme
		{ duration: "2m", target: 500 }, // maximum
		{ duration: "2m", target: 500 }, // sustain max
		{ duration: "2m", target: 0 }, // recovery
	],
	thresholds: {
		// Relaxed thresholds for stress testing - we expect some failures
		http_req_failed: ["rate<0.20"], // Allow up to 20% errors
		http_req_duration: ["p(95)<5000"], // p95 < 5s
		stress_success_rate: ["rate>0.70"], // At least 70% success
	},
};

const headers = getHeaders();

export default function () {
	activeVUs.add(__VU);

	// Mix of operations
	const selector = Math.random();

	if (selector < 0.3) {
		stressReadRooms();
	} else if (selector < 0.5) {
		stressReadGuests();
	} else if (selector < 0.65) {
		stressReadBilling();
	} else if (selector < 0.8) {
		stressCreateGuest();
	} else if (selector < 0.9) {
		stressCreateReservation();
	} else {
		stressMultipleReads();
	}

	sleep(sleepWithJitter(0.2, 0.3));
}

function stressReadRooms() {
	const response = http.get(
		`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=50`,
		{ headers, tags: { operation: "stress_read", service: "rooms" } },
	);

	recordMetrics(response);
}

function stressReadGuests() {
	const response = http.get(
		`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${TENANT_ID}&limit=50`,
		{ headers, tags: { operation: "stress_read", service: "guests" } },
	);

	recordMetrics(response);
}

function stressReadBilling() {
	const response = http.get(
		`${GATEWAY_URL}${ENDPOINTS.payments}?tenant_id=${TENANT_ID}&limit=50`,
		{ headers, tags: { operation: "stress_read", service: "billing" } },
	);

	recordMetrics(response);
}

function stressCreateGuest() {
	const guestData = generateGuest(TENANT_ID);

	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.guests}`,
		JSON.stringify(guestData),
		{ headers, tags: { operation: "stress_write", service: "guests" } },
	);

	recordMetrics(response, true);
}

function stressCreateReservation() {
	const reservationData = generateReservation(
		TENANT_ID,
		PROPERTY_ID,
		ROOM_TYPE_ID,
	);

	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.reservations}`,
		JSON.stringify(reservationData),
		{ headers, tags: { operation: "stress_write", service: "reservations" } },
	);

	recordMetrics(response, true);
}

function stressMultipleReads() {
	// Batch multiple read requests to stress connection pooling
	const responses = http.batch([
		[
			"GET",
			`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=10`,
			null,
			{ headers },
		],
		[
			"GET",
			`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${TENANT_ID}&limit=10`,
			null,
			{ headers },
		],
		[
			"GET",
			`${GATEWAY_URL}${ENDPOINTS.payments}?tenant_id=${TENANT_ID}&limit=10`,
			null,
			{ headers },
		],
	]);

	for (const response of responses) {
		recordMetrics(response);
	}
}

function recordMetrics(response, isWrite = false) {
	const success = isSuccess(response);

	responseLatency.add(response.timings.duration);
	successRate.add(success);
	throughput.add(1);

	if (!success) {
		errorCount.add(1);
	} else {
		// Track highest VU count with successful responses
		if (__VU > maxSuccessfulVUs) {
			maxSuccessfulVUs = __VU;
		}
	}

	// Detect breaking point (first sustained errors)
	if (!success && breakingPointVUs === 0 && __VU > 100) {
		breakingPointVUs = __VU;
	}

	check(
		response,
		{
			"response ok": (r) => isSuccess(r),
			"response time < 3s": (r) => r.timings.duration < 3000,
		},
		{ operation: isWrite ? "write" : "read" },
	);
}

export function handleSummary(data) {
	const totalRequests = data.metrics.http_reqs?.values.count || 0;
	const errorRate =
		((data.metrics.http_req_failed?.values.rate || 0) * 100).toFixed(2) || "0";
	const p95Latency =
		data.metrics.stress_response_latency?.values["p(95)"]?.toFixed(0) || "N/A";
	const p99Latency =
		data.metrics.stress_response_latency?.values["p(99)"]?.toFixed(0) || "N/A";
	const successPct =
		((data.metrics.stress_success_rate?.values.rate || 0) * 100).toFixed(1) ||
		"N/A";

	return {
		stdout: `
╔════════════════════════════════════════════════════════════╗
║                   STRESS TEST SUMMARY                       ║
╠════════════════════════════════════════════════════════════╣
║  Peak VUs: 500
║  Total Requests: ${totalRequests}
║  Success Rate: ${successPct}%
║  Error Rate: ${errorRate}%
║  p95 Latency: ${p95Latency}ms
║  p99 Latency: ${p99Latency}ms
╠════════════════════════════════════════════════════════════╣
║  CAPACITY ANALYSIS:
║  - Max Successful VUs: ${maxSuccessfulVUs}
║  - Breaking Point: ${breakingPointVUs > 0 ? breakingPointVUs + " VUs" : "Not reached"}
╚════════════════════════════════════════════════════════════╝
`,
	};
}
