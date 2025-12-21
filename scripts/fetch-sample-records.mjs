#!/usr/bin/env node

/**
 * Fetch representative records for each Tartware service.
 *
 * 1. Queries Postgres for a tenant plus related sample entities.
 * 2. Calls the public API Gateway and prints a sample payload per service.
 *
 * Required env vars:
 *   - API_TOKEN (JWT with tenant access)
 * Optional env vars:
 *   - GATEWAY_BASE_URL (default: http://localhost:8080)
 *   - DATABASE_URL or PG* connection settings
 */

import process from "node:process";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv();

const BASE_URL = process.env.GATEWAY_BASE_URL ?? "http://localhost:8080";
const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
	console.error("❌ API_TOKEN env var is required to call the gateway.");
	process.exit(1);
}

const buildPgConfig = () => {
	if (process.env.DATABASE_URL) {
		return { connectionString: process.env.DATABASE_URL };
	}
	return {
		host: process.env.PGHOST ?? "127.0.0.1",
		port: Number(process.env.PGPORT ?? "5432"),
		database: process.env.PGDATABASE ?? "tartware",
		user: process.env.PGUSER ?? "postgres",
		password: process.env.PGPASSWORD ?? "postgres",
		ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
	};
};

const client = new Client(buildPgConfig());

const fetchOne = async (sql, params = []) => {
	const { rows } = await client.query(sql, params);
	return rows[0] ?? null;
};

const collectSampleRecords = async () => {
	const tenant = await fetchOne(
		`SELECT id, name
     FROM tenants
     WHERE COALESCE(is_deleted, FALSE) = FALSE
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
	);
	if (!tenant) {
		throw new Error("No tenant records found.");
	}

	const property = await fetchOne(
		`SELECT id, name
     FROM properties
     WHERE tenant_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
		[tenant.id],
	);

	const room = await fetchOne(
		`SELECT id, room_number
     FROM rooms
     WHERE tenant_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
		[tenant.id],
	);

	const guest = await fetchOne(
		`SELECT id, first_name, last_name, email
     FROM guests
     WHERE tenant_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
		[tenant.id],
	);

	const reservation = await fetchOne(
		`SELECT id, status, check_in_date, check_out_date
     FROM reservations
     WHERE tenant_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
		[tenant.id],
	);

	const housekeepingTask = await fetchOne(
		`SELECT id, room_id, status
     FROM housekeeping_tasks
     WHERE tenant_id = $1
     ORDER BY updated_at DESC NULLS LAST, scheduled_date DESC NULLS LAST
     LIMIT 1`,
		[tenant.id],
	);

	const payment = await fetchOne(
		`SELECT id, payment_reference, status
     FROM payments
     WHERE tenant_id = $1
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
		[tenant.id],
	);

	return {
		tenant,
		property,
		room,
		guest,
		reservation,
		housekeepingTask,
		payment,
	};
};

const selectSamplePayload = (body) => {
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

const fetchSamplesFromApi = async (samples) => {
	const headers = {
		Authorization: `Bearer ${API_TOKEN}`,
		"Content-Type": "application/json",
	};

	const calls = [
		{
			service: "core-reservations",
			path: "/v1/reservations",
			params: {
				tenant_id: samples.tenant?.id,
				limit: 1,
			},
		},
		{
			service: "rooms",
			path: "/v1/rooms",
			params: {
				tenant_id: samples.tenant?.id,
				property_id: samples.property?.id,
				limit: 1,
			},
		},
		{
			service: "guests",
			path: "/v1/guests",
			params: {
				tenant_id: samples.tenant?.id,
				limit: 1,
			},
		},
		{
			service: "billing",
			path: "/v1/billing/payments",
			params: {
				tenant_id: samples.tenant?.id,
				property_id: samples.property?.id,
				limit: 1,
			},
		},
		{
			service: "housekeeping",
			path: "/v1/housekeeping/tasks",
			params: {
				tenant_id: samples.tenant?.id,
				property_id: samples.property?.id,
				limit: 1,
			},
		},
		{
			service: "settings",
			path: "/v1/settings/values",
			params: {},
		},
	];

	const results = [];
	for (const call of calls) {
		if (Object.values(call.params ?? {}).some((value) => !value)) {
			results.push({
				service: call.service,
				skipped: true,
				reason: "Missing required sample identifiers.",
			});
			continue;
		}
		const url = new URL(call.path, BASE_URL);
		for (const [key, value] of Object.entries(call.params ?? {})) {
			url.searchParams.set(key, String(value));
		}

		try {
			const response = await fetch(url, { headers });
			const text = await response.text();
			let body;
			try {
				body = text ? JSON.parse(text) : null;
			} catch (parseError) {
				body = { parseError: String(parseError), raw: text };
			}

			results.push({
				service: call.service,
				status: response.status,
				ok: response.ok,
				sample: response.ok ? selectSamplePayload(body) : null,
				error: response.ok ? null : body,
			});
		} catch (error) {
			results.push({
				service: call.service,
				status: "network-error",
				ok: false,
				error: String(error),
			});
		}
	}

	return results;
};

const main = async () => {
	await client.connect();
	try {
		const samples = await collectSampleRecords();
		console.log("📦 Sample records pulled from Postgres:");
		console.log(JSON.stringify(samples, null, 2));

		const apiResults = await fetchSamplesFromApi(samples);
		console.log("\n🌐 API samples via Gateway:");
		for (const result of apiResults) {
			if (result.skipped) {
				console.log(`- ${result.service}: skipped (${result.reason})`);
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
	} finally {
		await client.end().catch(() => {});
	}
};

main().catch((error) => {
	console.error("❌ Failed to collect sample records:", error);
	process.exit(1);
});

