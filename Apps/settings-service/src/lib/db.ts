import { Pool, type QueryResult, type QueryResultRow, types } from "pg";

import { config } from "../config.js";

const parseBigInt = (value: string | null): bigint | null => {
  if (value === null) {
    return null;
  }
  return BigInt(value);
};

const parseTimestamp = (value: string | null): Date | null => {
  if (value === null) {
    return null;
  }
  return new Date(`${value}Z`);
};

types.setTypeParser(20, parseBigInt as (value: string) => unknown);
types.setTypeParser(1114, parseTimestamp as (value: string) => unknown);
types.setTypeParser(1184, parseTimestamp as (value: string) => unknown);

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
});

pool.on("error", (error: unknown) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

/**
 * Executes a parameterized SQL statement against the shared PG pool.
 *
 * @example
 * const rows = await query('SELECT * FROM room_amenity_catalog WHERE property_id = $1', [propertyId]);
 *
 * @param text - SQL command text with positional parameters.
 * @param params - Values bound to the SQL command placeholders.
 * @returns A typed `QueryResult`.
 */
export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};
