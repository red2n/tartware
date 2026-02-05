/**
 * Spike test (v2)
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
	getHeaders,
	ENDPOINTS,
} from "../lib/config.js";
import { futureDate, sleepWithJitter, isSuccess } from "../lib/utils.js";
import { getToken } from "../lib/auth.js";

const spikeLatency = new Trend("spike_latency");
const spikeErrors = new Counter("spike_errors");
const spikeSuccess = new Rate("spike_success_rate");

export const options = {
	stages: [
		{ duration: "30s", target: 10 },
		{ duration: "10s", target: 200 },
		{ duration: "20s", target: 200 },
		{ duration: "10s", target: 10 },
		{ duration: "20s", target: 10 },
		{ duration: "10s", target: 300 },
		{ duration: "20s", target: 300 },
		{ duration: "10s", target: 0 },
	],
	thresholds: {
		http_req_failed: ["rate<0.15"],
		spike_success_rate: ["rate>0.8"],
	},
};

export default function () {
	const token = getToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	if (!token) return;
	const headers = getHeaders(token);
	const tenantId = TENANT_IDS[0];
	const propertyId = PROPERTY_IDS[0];

	const response = http.get(
		`${GATEWAY_URL}${ENDPOINTS.availability}?tenant_id=${tenantId}&property_id=${propertyId}&check_in=${futureDate(7)}&check_out=${futureDate(9)}`,
		{ headers, tags: { operation: "spike_availability" } },
	);

	const ok = isSuccess(response);
	spikeLatency.add(response.timings.duration);
	spikeSuccess.add(ok);
	if (!ok) spikeErrors.add(1);

	check(response, { "availability ok": () => ok });
	sleep(sleepWithJitter(0.1, 0.2));
}
