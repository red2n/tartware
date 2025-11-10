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
  const logger = (globalThis as { console?: { error: (...args: unknown[]) => void } }).console;
  logger?.error("Unexpected PostgreSQL pool error", error);
});

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> => {
  const result = await pool.query<T>(text, params);
  return result;
};
