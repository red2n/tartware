#!/usr/bin/env node

/**
 * Fetch sample records from the API Gateway using the provided entity IDs.
 *
 * Set the following environment variables (comma-separated lists allowed):
 *   API_TOKEN (required)
 *   GATEWAY_BASE_URL (default: http://localhost:8080)
 *   TENANT_IDS, PROPERTY_IDS, ROOM_TYPE_IDS, RESERVATION_IDS,
 *   GUEST_IDS, HOUSEKEEPING_TASK_IDS, HOUSEKEEPING_STAFF_IDS
 *
 * Example:
 *   API_TOKEN=... \
 *   TENANT_IDS=id1,id2 \
 *   PROPERTY_IDS=prop1 \
 *   node scripts/fetch-sample-api-records.mjs
 */

import process from "node:process";
import { config as loadEnv } from "dotenv";

loadEnv();

const BASE_URL = process.env.GATEWAY_BASE_URL ?? "http://localhost:8080";
const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
	console.error("❌ API_TOKEN environment variable is required.");
	process.exit(1);
}

const pickFirst = (value) => {
	if (!value) {
		return null;
	}
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)[0] ?? null;
};

const sampleIds = {
	tenantId: pickFirst(process.env.TENANT_IDS),
	propertyId: pickFirst(process.env.PROPERTY_IDS),
	roomTypeId: pickFirst(process.env.ROOM_TYPE_IDS),
	reservationId: pickFirst(process.env.RESERVATION_IDS),
	guestId: pickFirst(process.env.GUEST_IDS),
	housekeepingTaskId: pickFirst(process.env.HOUSEKEEPING_TASK_IDS),
	housekeepingStaffId: pickFirst(process.env.HOUSEKEEPING_STAFF_IDS),
};

const headers = {
	Authorization: `Bearer ${API_TOKEN}`,
	"Content-Type": "application/json",
};

const buildUrl = (path, params = {}) => {
	const url = new URL(path, BASE_URL);
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) {
			continue;
		}
		url.searchParams.set(key, String(value));
	}
	return url;
};

const selectSample = (body) => {
	if (!body) {
		return null;
	}
	if (Array.isArray(body)) {
		return body[0] ?? null;
	}
	if (Array.isArray(body.data)) {
		return body.data[0] ?? null;
	}
	return body.data ?? body;
};

const endpoints = [
	{
		service: "reservations",
		buildPath: (ids) => `/v1/tenants/${ids.tenantId}/reservations`,
		params: {
			limit: 1,
		},
		required: ["tenantId"],
	},
	{
		service: "rooms",
		path: "/v1/rooms",
		params: {
			tenant_id: sampleIds.tenantId,
			property_id: sampleIds.propertyId,
			limit: 1,
		},
		required: ["tenantId", "propertyId"],
	},
	{
		service: "guests",
		path: "/v1/guests",
		params: {
			tenant_id: sampleIds.tenantId,
			limit: 1,
		},
		required: ["tenantId"],
	},
	{
		service: "billing",
		path: "/v1/billing/payments",
		params: {
			tenant_id: sampleIds.tenantId,
			property_id: sampleIds.propertyId,
			limit: 1,
		},
		required: ["tenantId", "propertyId"],
	},
	{
		service: "housekeeping",
		path: "/v1/housekeeping/tasks",
		params: {
			tenant_id: sampleIds.tenantId,
			property_id: sampleIds.propertyId,
			limit: 1,
		},
		required: ["tenantId", "propertyId"],
	},
];

const fetchEndpoint = async (definition) => {
	const missing = definition.required.filter(
		(key) => sampleIds[key] === null,
	);
	if (missing.length > 0) {
		return {
			service: definition.service,
			status: "skipped",
			ok: false,
			message: `Missing required IDs: ${missing.join(", ")}`,
		};
	}
	const path =
		typeof definition.buildPath === "function"
			? definition.buildPath(sampleIds)
			: definition.path;
	const url = buildUrl(path, definition.params);
	try {
		const response = await fetch(url, { headers });
		const text = await response.text();
		let body = null;
		if (text) {
			try {
				body = JSON.parse(text);
			} catch (error) {
				body = { parseError: String(error), raw: text };
			}
		}
		return {
			service: definition.service,
			status: response.status,
			ok: response.ok,
			sample: response.ok ? selectSample(body) : null,
			error: response.ok ? null : body,
		};
	} catch (error) {
		return {
			service: definition.service,
			status: "network-error",
			ok: false,
			error: String(error),
		};
	}
};

const main = async () => {
	console.log("➡️  Using sample IDs:", JSON.stringify(sampleIds, null, 2));
	const results = [];
	for (const endpoint of endpoints) {
		// eslint-disable-next-line no-await-in-loop
		const result = await fetchEndpoint(endpoint);
		results.push(result);
	}
	console.log("\n📡 API responses:");
	for (const result of results) {
		if (result.status === "skipped") {
			console.log(`- ${result.service}: skipped (${result.message})`);
			continue;
		}
		const label = result.ok ? "ok" : "error";
		console.log(`- ${result.service}: ${label} (status: ${result.status})`);
		if (result.sample) {
			console.log(
				JSON.stringify(
					{ service: result.service, sample: result.sample },
					null,
					2,
				),
			);
		}
		if (!result.ok && result.error) {
			console.log(
				JSON.stringify(
					{ service: result.service, error: result.error },
					null,
					2,
				),
			);
		}
	}
};

main().catch((error) => {
	console.error("❌ Failed to fetch API samples:", error);
	process.exit(1);
});

