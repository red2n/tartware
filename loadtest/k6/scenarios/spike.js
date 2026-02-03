/**
 * Spike Test - Sudden traffic burst simulation
 *
 * Purpose: Test system resilience to sudden traffic spikes
 * Duration: ~5 minutes
 * VUs: 10 → 500 → 10 (sudden spikes)
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import {
	GATEWAY_URL,
	TENANT_ID,
	PROPERTY_ID,
	ROOM_TYPE_ID,
	getHeaders,
	ENDPOINTS,
} from "../lib/config.js";
import {
	generateGuest,
	generateReservation,
	sleepWithJitter,
	isSuccess,
} from "../lib/utils.js";

// Custom metrics for spike testing
const spikeLatency = new Trend("spike_latency");
const spikeErrors = new Counter("spike_errors");
const spikeSuccess = new Rate("spike_success_rate");
const recoveryLatency = new Trend("recovery_latency");

export const options = {
	stages: [
		// Normal traffic baseline
		{ duration: "30s", target: 10 },

		// First spike
		{ duration: "10s", target: 300 }, // sudden spike
		{ duration: "30s", target: 300 }, // sustain spike
		{ duration: "10s", target: 10 }, // sudden drop

		// Recovery period
		{ duration: "30s", target: 10 },

		// Second spike (larger)
		{ duration: "10s", target: 500 }, // bigger spike
		{ duration: "30s", target: 500 }, // sustain
		{ duration: "10s", target: 10 }, // drop

		// Final recovery
		{ duration: "30s", target: 10 },
		{ duration: "10s", target: 0 },
	],
	thresholds: {
		http_req_failed: ["rate<0.15"], // Allow 15% errors during spikes
		http_req_duration: ["p(95)<3000"], // p95 < 3s
		spike_success_rate: ["rate>0.80"], // 80% success across all phases
	},
};

const headers = getHeaders();

// Track which phase we're in
let currentPhase = "baseline";

export default function () {
	// Determine current phase based on VU count
	if (__VU <= 20) {
		currentPhase = "recovery";
	} else if (__VU <= 100) {
		currentPhase = "ramp";
	} else {
		currentPhase = "spike";
	}

	// Mix of operations (heavier on reads during spikes)
	const selector = Math.random();

	if (currentPhase === "spike") {
		// During spikes, favor read operations
		if (selector < 0.7) {
			spikeRead();
		} else {
			spikeWrite();
		}
	} else {
		// During normal/recovery, balanced mix
		if (selector < 0.5) {
			recoveryRead();
		} else {
			recoveryWrite();
		}
	}

	sleep(sleepWithJitter(0.1, 0.3));
}

function spikeRead() {
	group("Spike Read Operations", () => {
		const endpoints = [
			`${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=20`,
			`${ENDPOINTS.guests}?tenant_id=${TENANT_ID}&limit=20`,
			`${ENDPOINTS.payments}?tenant_id=${TENANT_ID}&limit=20`,
			`${ENDPOINTS.bookingSources}?tenant_id=${TENANT_ID}`,
			`${ENDPOINTS.marketSegments}?tenant_id=${TENANT_ID}`,
		];

		const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

		const response = http.get(`${GATEWAY_URL}${endpoint}`, {
			headers,
			tags: { phase: "spike", operation: "read" },
		});

		const success = isSuccess(response);
		spikeLatency.add(response.timings.duration);
		spikeSuccess.add(success);

		if (!success) {
			spikeErrors.add(1);
		}

		check(
			response,
			{
				"spike read ok": (r) => isSuccess(r),
				"spike read fast": (r) => r.timings.duration < 2000,
			},
			{ phase: "spike" },
		);
	});
}

function spikeWrite() {
	group("Spike Write Operations", () => {
		// Only attempt lightweight writes during spikes
		const guestData = generateGuest(TENANT_ID);

		const response = http.post(
			`${GATEWAY_URL}${ENDPOINTS.guests}`,
			JSON.stringify(guestData),
			{ headers, tags: { phase: "spike", operation: "write" } },
		);

		const success =
			response.status === 201 ||
			response.status === 200 ||
			response.status === 202;
		spikeLatency.add(response.timings.duration);
		spikeSuccess.add(success);

		if (!success) {
			spikeErrors.add(1);
		}

		check(
			response,
			{
				"spike write ok": (r) =>
					r.status === 201 || r.status === 200 || r.status === 202,
			},
			{ phase: "spike" },
		);
	});
}

function recoveryRead() {
	group("Recovery Read Operations", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { phase: "recovery", operation: "read" } },
		);

		const success = isSuccess(response);
		recoveryLatency.add(response.timings.duration);
		spikeSuccess.add(success);

		check(
			response,
			{
				"recovery read ok": (r) => isSuccess(r),
				"recovery latency normal": (r) => r.timings.duration < 500,
			},
			{ phase: "recovery" },
		);
	});
}

function recoveryWrite() {
	group("Recovery Write Operations", () => {
		const reservationData = generateReservation(
			TENANT_ID,
			PROPERTY_ID,
			ROOM_TYPE_ID,
		);

		const response = http.post(
			`${GATEWAY_URL}${ENDPOINTS.reservations}`,
			JSON.stringify(reservationData),
			{ headers, tags: { phase: "recovery", operation: "write" } },
		);

		const success =
			response.status === 201 ||
			response.status === 200 ||
			response.status === 202;
		recoveryLatency.add(response.timings.duration);
		spikeSuccess.add(success);

		check(
			response,
			{
				"recovery write ok": (r) =>
					r.status === 201 || r.status === 200 || r.status === 202,
			},
			{ phase: "recovery" },
		);
	});
}

export function handleSummary(data) {
	const totalRequests = data.metrics.http_reqs?.values.count || 0;
	const errorRate =
		((data.metrics.http_req_failed?.values.rate || 0) * 100).toFixed(2) || "0";
	const spikeP95 =
		data.metrics.spike_latency?.values["p(95)"]?.toFixed(0) || "N/A";
	const recoveryP95 =
		data.metrics.recovery_latency?.values["p(95)"]?.toFixed(0) || "N/A";
	const successPct =
		((data.metrics.spike_success_rate?.values.rate || 0) * 100).toFixed(1) ||
		"N/A";

	return {
		stdout: `
╔════════════════════════════════════════════════════════════╗
║                    SPIKE TEST SUMMARY                       ║
╠════════════════════════════════════════════════════════════╣
║  Peak VUs: 500 (sudden spike)
║  Total Requests: ${totalRequests}
║  Overall Success Rate: ${successPct}%
║  Error Rate: ${errorRate}%
╠════════════════════════════════════════════════════════════╣
║  LATENCY ANALYSIS:
║  - Spike p95: ${spikeP95}ms
║  - Recovery p95: ${recoveryP95}ms
╠════════════════════════════════════════════════════════════╣
║  RESILIENCE:
║  - System ${errorRate < 10 ? "PASSED" : "NEEDS IMPROVEMENT"} spike handling
║  - Recovery ${recoveryP95 !== "N/A" && Number(recoveryP95) < 500 ? "FAST" : "SLOW"}
╚════════════════════════════════════════════════════════════╝
`,
	};
}
