#!/usr/bin/env tsx

/**
 * Bootstraps (upserts) a system administrator account and prints a SYSTEM_ADMIN token.
 *
 * Env/config:
 *   DATABASE_URL or PG* vars (PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)
 *   ADMIN_USERNAME   (default: sysadmin)
 *   ADMIN_EMAIL      (default: sysadmin@example.com)
 *   ADMIN_PASSWORD   (default: AUTH_DEFAULT_PASSWORD or ChangeMe123!)
 *   ADMIN_ROLE       (default: SYSTEM_ADMIN)
 *   ADMIN_IPS        (comma-separated CIDRs, default: 127.0.0.1/32,::1/128)
 *   RESET_PASSWORD   (true/false; when true, always replace the password)
 *
 * Usage:
 *   ADMIN_PASSWORD='S3curePassw0rd!' tsx scripts/bootstrap-system-admin-token.ts
 *
 * Notes:
 * - Uses the core-service JWT/system-admin config, so ensure AUTH_JWT_SECRET or
 *   SYSTEM_ADMIN_JWT_SECRET is set to match the running cluster.
 * - MFA is disabled for the bootstrapped admin; rotate/enable MFA afterwards.
 */

import { randomUUID } from "node:crypto";
import process from "node:process";
import bcrypt from "bcryptjs";
import { Client } from "pg";

import { config } from "../src/config.js";
import { signSystemAdminToken } from "../src/lib/jwt.js";

const log = (message: string) => console.log(`[bootstrap-admin] ${message}`);
const warn = (message: string) => console.warn(`[bootstrap-admin][warn] ${message}`);
const fail = (message: string): never => {
	console.error(`[bootstrap-admin][error] ${message}`);
	process.exit(1);
};

const toBool = (value: string | undefined, fallback = false): boolean => {
	if (value === undefined) return fallback;
	return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
};

const defaultPassword = process.env.AUTH_DEFAULT_PASSWORD ?? "ChangeMe123!";

const settings = {
	username: process.env.ADMIN_USERNAME ?? "sysadmin",
	email: process.env.ADMIN_EMAIL ?? "sysadmin@example.com",
	password: process.env.ADMIN_PASSWORD ?? defaultPassword,
	role: process.env.ADMIN_ROLE ?? "SYSTEM_ADMIN",
	ips: (process.env.ADMIN_IPS ?? "127.0.0.1/32,::1/128")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean),
	resetPassword: toBool(process.env.RESET_PASSWORD, false),
	mfaSecret: process.env.ADMIN_MFA_SECRET ?? null,
};

const buildClientConfig = () => {
	if (process.env.DATABASE_URL) {
		return { connectionString: process.env.DATABASE_URL };
	}

	const host = process.env.PGHOST ?? "localhost";
	const port = Number(process.env.PGPORT ?? "5432");
	const database = process.env.PGDATABASE ?? "tartware";
	const user = process.env.PGUSER ?? "postgres";
	const password = process.env.PGPASSWORD ?? "postgres";
	return { host, port, database, user, password };
};

const ensureAdmin = async (client: Client) => {
	const { username, email, password, role, ips, resetPassword, mfaSecret } = settings;
	const { rows } = await client.query(
		"SELECT id, password_hash, is_active FROM system_administrators WHERE username = $1 LIMIT 1",
		[username],
	);

	const hashedPassword = await bcrypt.hash(password, 12);
	const now = new Date();

	if (rows.length === 0) {
		const id = randomUUID();
		await client.query(
			`INSERT INTO system_administrators (
				id, username, email, password_hash, role, mfa_secret, mfa_enabled,
				ip_whitelist, allowed_hours, metadata, is_active, created_at
			) VALUES (
				$1::uuid, $2, $3, $4, $5::system_admin_role, $6, false,
				$7::inet[], NULL, $8::jsonb, true, $9
			)` ,
			[id, username, email, hashedPassword, role, mfaSecret, ips, JSON.stringify({ trusted_devices: ["*"] }), now],
		);
		return { id, passwordChanged: true } as const;
	}

	const admin = rows[0] as { id: string; password_hash: string; is_active: boolean };
	let passwordChanged = false;

	if (resetPassword) {
		await client.query(
			`UPDATE system_administrators
			 SET password_hash = $2,
			     mfa_secret = $3,
			     failed_login_attempts = 0,
			     account_locked_until = NULL,
			     is_active = true,
			     updated_at = $4
			 WHERE id = $1`,
			[admin.id, hashedPassword, mfaSecret, now],
		);
		passwordChanged = true;
	} else if (mfaSecret) {
		// Update MFA secret without changing password
		await client.query(
			`UPDATE system_administrators
			 SET mfa_secret = $2,
			     failed_login_attempts = 0,
			     account_locked_until = NULL,
			     updated_at = $3
			 WHERE id = $1`,
			[admin.id, mfaSecret, now],
		);
	} else {
		// Always unlock account and reset failed attempts when running bootstrap
		await client.query(
			`UPDATE system_administrators
			 SET failed_login_attempts = 0,
			     account_locked_until = NULL,
			     updated_at = $2
			 WHERE id = $1`,
			[admin.id, now],
		);
	}

	if (!admin.is_active) {
		await client.query(
			"UPDATE system_administrators SET is_active = true, updated_at = $2 WHERE id = $1",
			[admin.id, now],
		);
	}

	return { id: admin.id, passwordChanged } as const;
};

const main = async () => {
	log(`Target DB: ${process.env.DATABASE_URL ?? `${process.env.PGUSER ?? "postgres"}@${process.env.PGHOST ?? "localhost"}:${process.env.PGPORT ?? "5432"}/${process.env.PGDATABASE ?? "tartware"}`}`);
	const client = new Client(buildClientConfig());
	await client.connect();

	try {
		const { id, passwordChanged } = await ensureAdmin(client);
		if (passwordChanged) {
			warn("Password was created/reset; rotate after initial login and enable MFA.");
		}

		const sessionId = randomUUID();
		const token = signSystemAdminToken({
			adminId: id,
			username: settings.username,
			role: settings.role as never,
			sessionId,
		});

		const expirySeconds = config.systemAdmin.jwt.expiresInSeconds;

		log("System admin token ready. Export and use as Authorization: Bearer <token>");
		console.log(JSON.stringify({
			username: settings.username,
			email: settings.email,
			role: settings.role,
			session_id: sessionId,
			token,
			expires_in: expirySeconds,
			scope: "SYSTEM_ADMIN",
		}, null, 2));
	} finally {
		await client.end();
	}
};

main().catch((error) => {
	fail(error instanceof Error ? error.message : String(error));
});
