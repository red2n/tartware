/**
 * Settings Service Load Test
 *
 * Tests: Packages, Configurations, Policies
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
	DEFAULT_THRESHOLDS,
} from "../lib/config.js";
import { sleepWithJitter, isSuccess, pickRandom } from "../lib/utils.js";

const settingsLatency = new Trend("settings_service_latency");
const settingsErrors = new Counter("settings_service_errors");
const settingsSuccess = new Rate("settings_service_success_rate");

export const options = {
	stages: [
		{ duration: "20s", target: Math.floor(VUS / 2) },
		{ duration: DURATION, target: VUS },
		{ duration: "20s", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		settings_service_latency: ["p(95)<250", "p(99)<500"],
		settings_service_success_rate: ["rate>0.98"],
	},
};

const headers = getHeaders();

const SETTINGS_ENDPOINTS = {
	packages: "/settings/packages",
	policies: "/settings/policies",
	cancellationPolicies: "/settings/cancellation-policies",
	depositPolicies: "/settings/deposit-policies",
	ratePlans: "/settings/rate-plans",
	seasons: "/settings/seasons",
	configurations: "/settings/configurations",
};

export function setup() {
	const packagesRes = http.get(
		`${GATEWAY_URL}${SETTINGS_ENDPOINTS.packages}?tenant_id=${TENANT_ID}`,
		{ headers },
	);

	let packages = [];
	if (packagesRes.status === 200) {
		try {
			const data = JSON.parse(packagesRes.body);
			packages = Array.isArray(data) ? data : data.data || [];
		} catch (e) {
			packages = [];
		}
	}

	return { packages };
}

export default function (data) {
	const { packages } = data || { packages: [] };
	const selector = Math.random();

	if (selector < 0.25) {
		testListPackages();
	} else if (selector < 0.4) {
		testGetPackage(packages);
	} else if (selector < 0.55) {
		testCancellationPolicies();
	} else if (selector < 0.7) {
		testDepositPolicies();
	} else if (selector < 0.85) {
		testRatePlans();
	} else {
		testSeasons();
	}

	sleep(sleepWithJitter(0.2));
}

function testListPackages() {
	group("Settings - List Packages", () => {
		const response = http.get(
			`${GATEWAY_URL}${SETTINGS_ENDPOINTS.packages}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", endpoint: "packages-list" } },
		);

		recordMetrics(response, "packages-list");
	});
}

function testGetPackage(packages) {
	if (!packages || packages.length === 0) {
		testListPackages();
		return;
	}

	group("Settings - Get Package by ID", () => {
		const pkg = pickRandom(packages);
		const packageId = pkg.package_id || pkg.id;

		const response = http.get(
			`${GATEWAY_URL}${SETTINGS_ENDPOINTS.packages}/${packageId}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", endpoint: "package-get" } },
		);

		recordMetrics(response, "package-get");
	});
}

function testCancellationPolicies() {
	group("Settings - Cancellation Policies", () => {
		const response = http.get(
			`${GATEWAY_URL}${SETTINGS_ENDPOINTS.cancellationPolicies}?tenant_id=${TENANT_ID}`,
			{
				headers,
				tags: { service: "settings", endpoint: "cancellation-policies" },
			},
		);

		recordMetrics(response, "cancellation-policies");
	});
}

function testDepositPolicies() {
	group("Settings - Deposit Policies", () => {
		const response = http.get(
			`${GATEWAY_URL}${SETTINGS_ENDPOINTS.depositPolicies}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", endpoint: "deposit-policies" } },
		);

		recordMetrics(response, "deposit-policies");
	});
}

function testRatePlans() {
	group("Settings - Rate Plans", () => {
		const response = http.get(
			`${GATEWAY_URL}${SETTINGS_ENDPOINTS.ratePlans}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", endpoint: "rate-plans" } },
		);

		recordMetrics(response, "rate-plans");
	});
}

function testSeasons() {
	group("Settings - Seasons", () => {
		const response = http.get(
			`${GATEWAY_URL}${SETTINGS_ENDPOINTS.seasons}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "settings", endpoint: "seasons" } },
		);

		recordMetrics(response, "seasons");
	});
}

function recordMetrics(response, endpoint) {
	const success = isSuccess(response);

	settingsLatency.add(response.timings.duration);
	settingsSuccess.add(success);

	if (!success) {
		settingsErrors.add(1);
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
║              SETTINGS SERVICE TEST SUMMARY                  ║
╠════════════════════════════════════════════════════════════╣
║  Success Rate: ${((data.metrics.settings_service_success_rate?.values.rate || 0) * 100).toFixed(1)}%
║  p95 Latency: ${data.metrics.settings_service_latency?.values["p(95)"]?.toFixed(0) || "N/A"}ms
║  Error Count: ${data.metrics.settings_service_errors?.values.count || 0}
║  Total Requests: ${data.metrics.http_reqs?.values.count || 0}
╚════════════════════════════════════════════════════════════╝
`,
	};
}
