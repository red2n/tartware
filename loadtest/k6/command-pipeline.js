import http from "k6/http";
import { check, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import {
	ENDPOINTS,
	getHeaders,
	TENANT_ID,
	PROPERTY_ID,
	ROOM_TYPE_ID,
} from "./lib/config.js";
import {
	futureDate,
	generateReservation,
	pickRandom,
	randomInt,
	uuid,
} from "./lib/utils.js";

const commandErrors = new Rate("command_errors");
const readErrors = new Rate("read_errors");
const commandLatency = new Trend("command_latency");
const readLatency = new Trend("read_latency");
const commandCount = new Counter("command_requests");
const readCount = new Counter("read_requests");

const BASE_URL = __ENV.GATEWAY_BASE_URL || "http://localhost:8080";
const tenantIds = (__ENV.TENANT_IDS || TENANT_ID).split(",").filter(Boolean);
const propertyIds = (__ENV.PROPERTY_IDS || PROPERTY_ID)
	.split(",")
	.filter(Boolean);
const roomTypeIds = (__ENV.ROOM_TYPE_IDS || ROOM_TYPE_ID)
	.split(",")
	.filter(Boolean);

const commandStartRate = Number(__ENV.COMMAND_START_RATE || 1000);
const commandTargetRate = Number(__ENV.COMMAND_TARGET_RATE || 30000);
const commandPreallocatedVus = Number(__ENV.COMMAND_PREALLOCATED_VUS || 2000);
const commandMaxVus = Number(__ENV.COMMAND_MAX_VUS || 8000);

const readRate = Number(__ENV.READ_RATE || 12000);
const readPreallocatedVus = Number(__ENV.READ_PREALLOCATED_VUS || 600);
const readMaxVus = Number(__ENV.READ_MAX_VUS || 2400);

const testDuration = __ENV.TEST_DURATION || "20m";
const disableThresholds = (__ENV.DISABLE_THRESHOLDS || "false") === "true";

const thresholds = disableThresholds
	? {}
	: {
			http_req_failed: ["rate<0.05"],
			command_errors: ["rate<0.05"],
			read_errors: ["rate<0.05"],
			command_latency: ["p(95)<800"],
			read_latency: ["p(95)<500"],
		};

export const options = {
	scenarios: {
		commandPipeline: {
			executor: "ramping-arrival-rate",
			exec: "commandPipeline",
			startRate: commandStartRate,
			timeUnit: "1s",
			preAllocatedVUs: commandPreallocatedVus,
			maxVUs: commandMaxVus,
			stages: [
				{ target: commandStartRate, duration: "2m" },
				{ target: commandTargetRate, duration: "6m" },
				{ target: commandTargetRate, duration: testDuration },
			],
			gracefulStop: "30s",
		},
		readPipeline: {
			executor: "constant-arrival-rate",
			exec: "readPipeline",
			rate: readRate,
			timeUnit: "1s",
			preAllocatedVUs: readPreallocatedVus,
			maxVUs: readMaxVus,
			duration: testDuration,
			gracefulStop: "30s",
		},
	},
	thresholds,
};

const baseHeaders = getHeaders();

function pickTenant() {
	return pickRandom(tenantIds) || TENANT_ID;
}

function pickProperty() {
	return pickRandom(propertyIds) || PROPERTY_ID;
}

function pickRoomType() {
	return pickRandom(roomTypeIds) || ROOM_TYPE_ID;
}

export function commandPipeline() {
	group("Create Reservation", () => {
		const tenantId = pickTenant();
		const propertyId = pickProperty();
		const roomTypeId = pickRoomType();
		const reservation = generateReservation(tenantId, propertyId, roomTypeId);

		const headers = Object.assign({}, baseHeaders, {
			"Idempotency-Key": uuid(),
		});

		const response = http.post(
			`${BASE_URL}${ENDPOINTS.reservations}`,
			JSON.stringify(reservation),
			{ headers, tags: { pipeline: "command" } },
		);

		const ok = check(response, {
			"reservation accepted": (r) => r.status === 200 || r.status === 201,
		});

		commandErrors.add(!ok);
		commandLatency.add(response.timings.duration);
		commandCount.add(1);
	});
}

export function readPipeline() {
	group("Read Availability", () => {
		const tenantId = pickTenant();
		const propertyId = pickProperty();
		const checkInDate = futureDate(randomInt(1, 30));
		const checkOutDate = futureDate(randomInt(31, 45));

		const response = http.get(
			`${BASE_URL}${ENDPOINTS.availability}?tenant_id=${tenantId}&property_id=${propertyId}&check_in=${checkInDate}&check_out=${checkOutDate}`,
			{ headers: baseHeaders, tags: { pipeline: "read" } },
		);

		const ok = check(response, {
			"availability ok": (r) => r.status >= 200 && r.status < 300,
		});

		readErrors.add(!ok);
		readLatency.add(response.timings.duration);
		readCount.add(1);
	});

	group("Read Rates", () => {
		const tenantId = pickTenant();
		const propertyId = pickProperty();
		const response = http.get(
			`${BASE_URL}${ENDPOINTS.rates}?tenant_id=${tenantId}&property_id=${propertyId}`,
			{ headers: baseHeaders, tags: { pipeline: "read" } },
		);

		const ok = check(response, {
			"rates ok": (r) => r.status >= 200 && r.status < 300,
		});

		readErrors.add(!ok);
		readLatency.add(response.timings.duration);
		readCount.add(1);
	});

	group("Read Rooms", () => {
		const tenantId = pickTenant();
		const response = http.get(
			`${BASE_URL}${ENDPOINTS.rooms}?tenant_id=${tenantId}&limit=20`,
			{ headers: baseHeaders, tags: { pipeline: "read" } },
		);

		const ok = check(response, {
			"rooms ok": (r) => r.status >= 200 && r.status < 300,
		});

		readErrors.add(!ok);
		readLatency.add(response.timings.duration);
		readCount.add(1);
	});
}

function formatMetricValue(value) {
	if (value === null || value === undefined) return "n/a";
	if (typeof value === "number") return value.toFixed(2);
	return String(value);
}

function renderMetricRow(name, metric) {
	if (!metric || !metric.values) return "";
	const values = metric.values;
	const columns = [
		formatMetricValue(values.count),
		formatMetricValue(values.rate),
		formatMetricValue(values.avg),
		formatMetricValue(values.min),
		formatMetricValue(values.max),
		formatMetricValue(
			values["p(90)"] !== undefined ? values["p(90)"] : values.p90,
		),
		formatMetricValue(
			values["p(95)"] !== undefined ? values["p(95)"] : values.p95,
		),
		formatMetricValue(
			values["p(99)"] !== undefined ? values["p(99)"] : values.p99,
		),
	];

	return `
		<tr>
			<td>${name}</td>
			<td>${metric.type || ""}</td>
			${columns.map((value) => `<td>${value}</td>`).join("")}
		</tr>
	`;
}

function renderHtmlSummary(data) {
	const metrics = data.metrics || {};
	const metricNames = [
		"http_reqs",
		"http_req_failed",
		"http_req_duration",
		"http_req_waiting",
		"http_req_connecting",
		"iterations",
		"vus",
		"vus_max",
		"data_received",
		"data_sent",
		"command_latency",
		"read_latency",
		"command_errors",
		"read_errors",
	];

	const rows = metricNames
		.map((name) => renderMetricRow(name, metrics[name]))
		.filter(Boolean)
		.join("");

	return `
		<!doctype html>
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<title>Tartware k6 Load Test Summary</title>
				<style>
					body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
					h1 { margin-bottom: 4px; }
					p { margin-top: 0; color: #555; }
					table { border-collapse: collapse; width: 100%; margin-top: 16px; }
					th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
					th { background: #f5f5f5; }
					tr:nth-child(even) { background: #fafafa; }
					.badge { display: inline-block; padding: 2px 8px; background: #111827; color: #fff; border-radius: 999px; font-size: 12px; }
				</style>
			</head>
			<body>
				<h1>Tartware k6 Load Test Summary</h1>
				<p><span class="badge">${new Date().toISOString()}</span></p>
				<h2>Key Metrics</h2>
				<table>
					<thead>
						<tr>
							<th>Metric</th>
							<th>Type</th>
							<th>Count</th>
							<th>Rate</th>
							<th>Avg</th>
							<th>Min</th>
							<th>Max</th>
							<th>p90</th>
							<th>p95</th>
							<th>p99</th>
						</tr>
					</thead>
					<tbody>
						${rows}
					</tbody>
				</table>
			</body>
		</html>
	`;
}

export function handleSummary(data) {
	return {
		"/tmp/k6-summary.html": renderHtmlSummary(data),
		"/tmp/k6-summary.json": JSON.stringify(data, null, 2),
	};
}
