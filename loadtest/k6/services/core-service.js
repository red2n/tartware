/**
 * Core Service Load Test
 *
 * Tests: Properties, Tenants, Users, Auth, Booking Config
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
import { sleepWithJitter, isSuccess } from "../lib/utils.js";

const coreLatency = new Trend("core_service_latency");
const coreErrors = new Counter("core_service_errors");
const coreSuccess = new Rate("core_service_success_rate");

export const options = {
	stages: [
		{ duration: "30s", target: Math.floor(VUS / 2) },
		{ duration: DURATION, target: VUS },
		{ duration: "30s", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		core_service_latency: ["p(95)<400", "p(99)<800"],
		core_service_success_rate: ["rate>0.95"],
	},
};

const headers = getHeaders();

export default function () {
	const selector = Math.random();

	if (selector < 0.2) {
		testProperties();
	} else if (selector < 0.35) {
		testBookingSources();
	} else if (selector < 0.5) {
		testMarketSegments();
	} else if (selector < 0.65) {
		testAllotments();
	} else if (selector < 0.75) {
		testChannelMappings();
	} else if (selector < 0.85) {
		testCompanies();
	} else if (selector < 0.92) {
		testMeetingRooms();
	} else {
		testWaitlist();
	}

	sleep(sleepWithJitter(0.3));
}

function testProperties() {
	group("Core - Properties", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.properties}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", endpoint: "properties" } },
		);

		recordMetrics(response, "properties");
	});
}

function testBookingSources() {
	group("Core - Booking Sources", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.bookingSources}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", endpoint: "booking-sources" } },
		);

		recordMetrics(response, "booking-sources");
	});
}

function testMarketSegments() {
	group("Core - Market Segments", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.marketSegments}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", endpoint: "market-segments" } },
		);

		recordMetrics(response, "market-segments");
	});
}

function testAllotments() {
	group("Core - Allotments", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.allotments}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", endpoint: "allotments" } },
		);

		recordMetrics(response, "allotments");
	});
}

function testChannelMappings() {
	group("Core - Channel Mappings", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.channelMappings}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", endpoint: "channel-mappings" } },
		);

		recordMetrics(response, "channel-mappings");
	});
}

function testCompanies() {
	group("Core - Companies", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.companies}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", endpoint: "companies" } },
		);

		recordMetrics(response, "companies");
	});
}

function testMeetingRooms() {
	group("Core - Meeting Rooms", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.meetingRooms}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", endpoint: "meeting-rooms" } },
		);

		recordMetrics(response, "meeting-rooms");
	});
}

function testWaitlist() {
	group("Core - Waitlist", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.waitlist}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "core", endpoint: "waitlist" } },
		);

		recordMetrics(response, "waitlist");
	});
}

function recordMetrics(response, endpoint) {
	const success = isSuccess(response);

	coreLatency.add(response.timings.duration);
	coreSuccess.add(success);

	if (!success) {
		coreErrors.add(1);
	}

	check(
		response,
		{
			[`${endpoint} status ok`]: (r) => isSuccess(r),
			[`${endpoint} has body`]: (r) => r.body && r.body.length > 0,
		},
		{ endpoint },
	);
}

export function handleSummary(data) {
	return {
		stdout: `
╔════════════════════════════════════════════════════════════╗
║               CORE SERVICE TEST SUMMARY                     ║
╠════════════════════════════════════════════════════════════╣
║  Success Rate: ${((data.metrics.core_service_success_rate?.values.rate || 0) * 100).toFixed(1)}%
║  p95 Latency: ${data.metrics.core_service_latency?.values["p(95)"]?.toFixed(0) || "N/A"}ms
║  Error Count: ${data.metrics.core_service_errors?.values.count || 0}
║  Total Requests: ${data.metrics.http_reqs?.values.count || 0}
╚════════════════════════════════════════════════════════════╝
`,
	};
}
