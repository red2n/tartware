#!/usr/bin/env node

/**
 * Nightly availability seeding helper
 * Seeds availability.room_availability for the requested window
 * Usage:
 *   npm run seed:availability -- --property=<uuid> --days=90
 */

import process from 'node:process';
import { Client } from 'pg';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {};

  for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const [rawKey, rawValue] = arg.substring(2).split('=');
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

    if (rawValue === undefined) {
      options[key] = true;
    } else {
      options[key] = rawValue;
    }
  }

  return options;
};

const main = async () => {
  const args = parseArgs();
  const tenantId = args.tenant ?? args.tenantId ?? null;
  const propertyId = args.property ?? args.propertyId ?? null;
  const seededBy =
    args.seededBy ??
    process.env.AVAILABILITY_SEEDED_BY ??
    process.env.USER ??
    'CLI_AVAILABILITY_SEED';

  const startDate =
    args.startDate ??
    new Date().toISOString().split('T')[0];

  const horizon = Number(args.days ?? args.horizon ?? 365);
  if (!Number.isFinite(horizon) || horizon <= 0) {
    throw new Error(`Invalid --days/--horizon value: ${args.days ?? args.horizon}`);
  }

  const seedMissingOnly = args.force ? false : true;

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'tartware',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };

  const client = new Client(dbConfig);

  try {
    console.log('🌱 Seeding availability grid');
    console.log(`   Tenant:   ${tenantId ?? '(all tenants)'}`);
    console.log(`   Property: ${propertyId ?? '(all properties)'}`);
    console.log(`   Window:   ${startDate} → ${horizon} days`);
    console.log(`   Mode:     ${seedMissingOnly ? 'missing rows only' : 'refresh existing rows'}`);

    await client.connect();

    const sql = `
      SELECT inserted_count, updated_count
      FROM seed_room_availability($1::uuid, $2::uuid, $3::integer, $4::boolean, $5::date, $6::text);
    `;

    const values = [
      tenantId,
      propertyId,
      horizon,
      seedMissingOnly,
      startDate,
      seededBy,
    ];

    const { rows } = await client.query(sql, values);
    const stats = rows?.[0] ?? { inserted_count: 0, updated_count: 0 };

    console.log(`✅ Availability seeding complete`);
    console.log(`   Inserted: ${stats.inserted_count ?? 0}`);
    console.log(`   Updated:  ${stats.updated_count ?? 0}`);
  } catch (error) {
    console.error('❌ Failed to seed availability:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {
      // ignore disconnect errors
    });
  }
};

main();
