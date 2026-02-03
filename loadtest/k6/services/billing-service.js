/**
 * Billing Service Load Test
 *
 * Tests: Payments, Invoices, Folios, Tax Configurations
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
	uuid,
	generatePayment,
	sleepWithJitter,
	isSuccess,
} from "../lib/utils.js";

const billingLatency = new Trend("billing_service_latency");
const billingErrors = new Counter("billing_service_errors");
const billingSuccess = new Rate("billing_service_success_rate");

export const options = {
	stages: [
		{ duration: "30s", target: Math.floor(VUS / 2) },
		{ duration: DURATION, target: VUS },
		{ duration: "30s", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		billing_service_latency: ["p(95)<500", "p(99)<1000"],
		billing_service_success_rate: ["rate>0.95"],
	},
};

const headers = getHeaders();

export default function () {
	const selector = Math.random();

	if (selector < 0.3) {
		testListPayments();
	} else if (selector < 0.5) {
		testListInvoices();
	} else if (selector < 0.65) {
		testListFolios();
	} else if (selector < 0.75) {
		testTaxConfigurations();
	} else {
		testCreatePayment();
	}

	sleep(sleepWithJitter(0.3));
}

function testListPayments() {
	group("Billing - List Payments", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.payments}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "billing", endpoint: "payments-list" } },
		);

		recordMetrics(response, "payments-list");
	});
}

function testListInvoices() {
	group("Billing - List Invoices", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.invoices}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "billing", endpoint: "invoices-list" } },
		);

		recordMetrics(response, "invoices-list");
	});
}

function testListFolios() {
	group("Billing - List Folios", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.folios}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "billing", endpoint: "folios-list" } },
		);

		recordMetrics(response, "folios-list");
	});
}

function testTaxConfigurations() {
	group("Billing - Tax Configurations", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.taxConfigurations}?tenant_id=${TENANT_ID}`,
			{
				headers,
				tags: { service: "billing", endpoint: "tax-configurations" },
			},
		);

		recordMetrics(response, "tax-configurations");
	});
}

function testCreatePayment() {
	group("Billing - Create Payment", () => {
		const paymentData = generatePayment(TENANT_ID, PROPERTY_ID);

		const response = http.post(
			`${GATEWAY_URL}${ENDPOINTS.payments}`,
			JSON.stringify(paymentData),
			{ headers, tags: { service: "billing", endpoint: "payments-create" } },
		);

		const success =
			response.status === 201 ||
			response.status === 200 ||
			response.status === 202;

		billingLatency.add(response.timings.duration);
		billingSuccess.add(success);

		if (!success) {
			billingErrors.add(1);
		}

		check(
			response,
			{
				"payment created": (r) =>
					r.status === 201 || r.status === 200 || r.status === 202,
			},
			{ endpoint: "payments-create" },
		);
	});
}

function recordMetrics(response, endpoint) {
	const success = isSuccess(response);

	billingLatency.add(response.timings.duration);
	billingSuccess.add(success);

	if (!success) {
		billingErrors.add(1);
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
║              BILLING SERVICE TEST SUMMARY                   ║
╠════════════════════════════════════════════════════════════╣
║  Success Rate: ${((data.metrics.billing_service_success_rate?.values.rate || 0) * 100).toFixed(1)}%
║  p95 Latency: ${data.metrics.billing_service_latency?.values["p(95)"]?.toFixed(0) || "N/A"}ms
║  Error Count: ${data.metrics.billing_service_errors?.values.count || 0}
║  Total Requests: ${data.metrics.http_reqs?.values.count || 0}
╚════════════════════════════════════════════════════════════╝
`,
	};
}
