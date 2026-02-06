/**
 * Stress test (v2)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter, Rate, Gauge } from "k6/metrics";
import {
	GATEWAY_URL,
	ADMIN_USERNAME,
	ADMIN_PASSWORD,
	TENANT_IDS,
	PROPERTY_IDS,
	VUS,
	getHeaders,
	ENDPOINTS,
} from "../lib/config.js";
import { futureDate, sleepWithJitter, isSuccess } from "../lib/utils.js";
import { getToken } from "../lib/auth.js";

const latency = new Trend("stress_latency");
const errors = new Counter("stress_errors");
const successRate = new Rate("stress_success_rate");
const activeVus = new Gauge("stress_active_vus");

export const options = {
	stages: [
		{ duration: "1m", target: Math.max(50, VUS) },
		{ duration: "2m", target: Math.max(100, VUS * 2) },
		{ duration: "2m", target: Math.max(200, VUS * 3) },
		{ duration: "2m", target: Math.max(300, VUS * 4) },
		{ duration: "2m", target: Math.max(400, VUS * 5) },
		{ duration: "2m", target: 0 },
	],
	thresholds: {
		http_req_failed: ["rate<0.2"],
		stress_success_rate: ["rate>0.7"],
		stress_latency: ["p(95)<5000"],
	},
};

export default function () {
	activeVus.add(__VU);
	const token = getToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	if (!token) return;
	const headers = getHeaders(token);

	const tenantId = TENANT_IDS[0];
	const propertyId = PROPERTY_IDS[0];

	const response = http.get(
		`${GATEWAY_URL}${ENDPOINTS.availability}?tenant_id=${tenantId}&property_id=${propertyId}&check_in=${futureDate(7)}&check_out=${futureDate(9)}`,
		{ headers, tags: { operation: "stress_availability" } },
	);

	const ok = isSuccess(response);
	latency.add(response.timings.duration);
	successRate.add(ok);
	if (!ok) errors.add(1);

	check(response, { "availability ok": () => ok });
	sleep(sleepWithJitter(0.2));
}
