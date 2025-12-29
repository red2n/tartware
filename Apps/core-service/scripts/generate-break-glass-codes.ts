#!/usr/bin/env tsx

/**
 * Generates hashed break-glass codes for an existing system administrator.
 *
 * Env/config:
 *   DATABASE_URL or PG* vars
 *   ADMIN_USERNAME            (required)
 *   BREAK_GLASS_COUNT         (default: 5)
 *   BREAK_GLASS_LABEL         (default: "vault-envelope")
 *   BREAK_GLASS_EXPIRES_HOURS (default: 0 == never expires)
 *   BREAK_GLASS_METADATA      (JSON string, optional)
 *
 * Usage:
 *   ADMIN_USERNAME=sysadmin BREAK_GLASS_COUNT=3 tsx scripts/generate-break-glass-codes.ts
 */

import { randomBytes, randomUUID } from "node:crypto";
import process from "node:process";
import bcrypt from "bcryptjs";
import { Client } from "pg";

import { SYSTEM_ADMIN_BREAK_GLASS_INSERT_SQL } from "../src/sql/system-admin-queries.js";

const log = (message: string) => console.log(`[break-glass] ${message}`);
const fail = (message: string): never => {
  console.error(`[break-glass][error] ${message}`);
  process.exit(1);
};

const settings = {
  username: process.env.ADMIN_USERNAME,
  count: Number(process.env.BREAK_GLASS_COUNT ?? "5"),
  label: process.env.BREAK_GLASS_LABEL ?? "vault-envelope",
  expiresHours: Number(process.env.BREAK_GLASS_EXPIRES_HOURS ?? "0"),
  metadataRaw: process.env.BREAK_GLASS_METADATA,
};

if (!settings.username) {
  fail("ADMIN_USERNAME is required.");
}

const parseMetadata = (): Record<string, unknown> => {
  if (!settings.metadataRaw) {
    return {};
  }
  try {
    const parsed = JSON.parse(settings.metadataRaw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch (error) {
    fail(
      `Invalid BREAK_GLASS_METADATA JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const buildClientConfig = () => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? "5432"),
    database: process.env.PGDATABASE ?? "tartware",
    user: process.env.PGUSER ?? "postgres",
    password: process.env.PGPASSWORD ?? "postgres",
  };
};

const generateCode = () => {
  const randomPart = randomBytes(4).toString("hex").toUpperCase();
  return `BG-${randomPart}`;
};

const main = async () => {
  const client = new Client(buildClientConfig());
  await client.connect();

  try {
    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM system_administrators WHERE username = $1 LIMIT 1",
      [settings.username],
    );
    if (rows.length === 0) {
      fail(`System administrator "${settings.username}" not found.`);
    }
    const adminId = rows[0].id;

    const expiresAt =
      settings.expiresHours > 0
        ? new Date(Date.now() + settings.expiresHours * 60 * 60 * 1000)
        : null;

    const metadata = {
      issued_by: process.env.USER ?? process.env.USERNAME ?? "generate-break-glass-codes",
      issued_at: new Date().toISOString(),
      label: settings.label,
      ...parseMetadata(),
    };

    const codes: { code: string; id: string }[] = [];

    for (let i = 0; i < settings.count; i += 1) {
      const plainCode = generateCode();
      const codeHash = await bcrypt.hash(plainCode, 12);
      const codeId = randomUUID();

      await client.query(SYSTEM_ADMIN_BREAK_GLASS_INSERT_SQL, [
        adminId,
        codeHash,
        settings.label,
        expiresAt,
        JSON.stringify(metadata),
      ]);

      codes.push({ code: plainCode, id: codeId });
    }

    log(`Issued ${codes.length} break-glass codes for ${settings.username}`);
    console.log(
      JSON.stringify(
        {
          username: settings.username,
          label: settings.label,
          expires_at: expiresAt?.toISOString() ?? null,
          codes: codes.map((entry) => entry.code),
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
