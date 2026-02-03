/**
 * Housekeeping Service Load Test
 *
 * Tests: Tasks, Maintenance Requests, Incident Reports
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
	generateHousekeepingTask,
	sleepWithJitter,
	isSuccess,
	pickRandom,
} from "../lib/utils.js";

const housekeepingLatency = new Trend("housekeeping_service_latency");
const housekeepingErrors = new Counter("housekeeping_service_errors");
const housekeepingSuccess = new Rate("housekeeping_service_success_rate");

export const options = {
	stages: [
		{ duration: "30s", target: Math.floor(VUS / 2) },
		{ duration: DURATION, target: VUS },
		{ duration: "30s", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		housekeeping_service_latency: ["p(95)<500", "p(99)<1000"],
		housekeeping_service_success_rate: ["rate>0.95"],
	},
};

const headers = getHeaders();

export default function () {
	const selector = Math.random();

	if (selector < 0.3) {
		testListTasks();
	} else if (selector < 0.5) {
		testFilteredTasks();
	} else if (selector < 0.7) {
		testMaintenanceRequests();
	} else if (selector < 0.85) {
		testIncidentReports();
	} else {
		testCreateTask();
	}

	sleep(sleepWithJitter(0.3));
}

function testListTasks() {
	group("Housekeeping - List Tasks", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.housekeepingTasks}?tenant_id=${TENANT_ID}&limit=20`,
			{ headers, tags: { service: "housekeeping", endpoint: "tasks-list" } },
		);

		recordMetrics(response, "tasks-list");
	});
}

function testFilteredTasks() {
	group("Housekeeping - Filtered Tasks", () => {
		const statuses = ["PENDING", "IN_PROGRESS", "COMPLETED"];
		const priorities = ["LOW", "NORMAL", "HIGH", "URGENT"];

		const status = pickRandom(statuses);
		const priority = pickRandom(priorities);

		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.housekeepingTasks}?tenant_id=${TENANT_ID}&status=${status}&priority=${priority}&limit=20`,
			{ headers, tags: { service: "housekeeping", endpoint: "tasks-filtered" } },
		);

		recordMetrics(response, "tasks-filtered");
	});
}

function testMaintenanceRequests() {
	group("Housekeeping - Maintenance Requests", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.maintenanceRequests}?tenant_id=${TENANT_ID}&limit=20`,
			{
				headers,
				tags: { service: "housekeeping", endpoint: "maintenance-requests" },
			},
		);

		recordMetrics(response, "maintenance-requests");
	});
}

function testIncidentReports() {
	group("Housekeeping - Incident Reports", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.incidentReports}?tenant_id=${TENANT_ID}&limit=20`,
			{
				headers,
				tags: { service: "housekeeping", endpoint: "incident-reports" },
			},
		);

		recordMetrics(response, "incident-reports");
	});
}

function testCreateTask() {
	group("Housekeeping - Create Task", () => {
		const taskData = generateHousekeepingTask(TENANT_ID, PROPERTY_ID);

		const response = http.post(
			`${GATEWAY_URL}${ENDPOINTS.housekeepingTasks}`,
			JSON.stringify(taskData),
			{ headers, tags: { service: "housekeeping", endpoint: "tasks-create" } },
		);

		const success =
			response.status === 201 ||
			response.status === 200 ||
			response.status === 202;

		housekeepingLatency.add(response.timings.duration);
		housekeepingSuccess.add(success);

		if (!success) {
			housekeepingErrors.add(1);
		}

		check(
			response,
			{
				"task created": (r) =>
					r.status === 201 || r.status === 200 || r.status === 202,
			},
			{ endpoint: "tasks-create" },
		);
	});
}

function recordMetrics(response, endpoint) {
	const success = isSuccess(response);

	housekeepingLatency.add(response.timings.duration);
	housekeepingSuccess.add(success);

	if (!success) {
		housekeepingErrors.add(1);
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
║            HOUSEKEEPING SERVICE TEST SUMMARY                ║
╠════════════════════════════════════════════════════════════╣
║  Success Rate: ${((data.metrics.housekeeping_service_success_rate?.values.rate || 0) * 100).toFixed(1)}%
║  p95 Latency: ${data.metrics.housekeeping_service_latency?.values["p(95)"]?.toFixed(0) || "N/A"}ms
║  Error Count: ${data.metrics.housekeeping_service_errors?.values.count || 0}
║  Total Requests: ${data.metrics.http_reqs?.values.count || 0}
╚════════════════════════════════════════════════════════════╝
`,
	};
}
