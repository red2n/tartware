/**
 * Smoke test (v2)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import {
	GATEWAY_URL,
	ADMIN_USERNAME,
	ADMIN_PASSWORD,
	TENANT_IDS,
	PROPERTY_IDS,
	getHeaders,
	ENDPOINTS,
} from "../lib/config.js";
import { getToken } from "../lib/auth.js";
import { futureDate } from "../lib/utils.js";

const smokeLatency = new Trend("smoke_latency");

export const options = {
	stages: [
		{ duration: "10s", target: 1 },
		{ duration: "20s", target: 2 },
		{ duration: "10s", target: 0 },
	],
	thresholds: {
		http_req_failed: ["rate<0.05"],
		http_req_duration: ["p(95)<2000"],
		checks: ["rate>0.9"],
	},
};

export default function () {
	const token = getToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	if (!token) {
		throw new Error("Failed to retrieve authentication token for smoke test");
	}
	const headers = getHeaders(token);

	const tenantId = TENANT_IDS[0];
	const propertyId = PROPERTY_IDS[0];

	probe("health", `${GATEWAY_URL}${ENDPOINTS.health}`);
	probe("tenants", `${GATEWAY_URL}${ENDPOINTS.tenants}`, headers);
	probe(
		"properties",
		`${GATEWAY_URL}${ENDPOINTS.properties}?tenant_id=${tenantId}`,
		headers,
	);
	probe(
		"room-types",
		`${GATEWAY_URL}${ENDPOINTS.roomTypes}?tenant_id=${tenantId}&property_id=${propertyId}`,
		headers,
	);
	probe(
		"availability",
		`${GATEWAY_URL}${ENDPOINTS.availability}?tenant_id=${tenantId}&property_id=${propertyId}&check_in=${futureDate(7)}&check_out=${futureDate(9)}`,
		headers,
	);

	sleep(0.4);
}

function probe(name, url, headers) {
	const response = http.get(url, { headers, tags: { name: `smoke_${name}` } });
	smokeLatency.add(response.timings.duration);
	check(response, {
		[`${name} ok`]: (r) => r.status >= 200 && r.status < 300,
	});
}
