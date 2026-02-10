import { Pool, type QueryResult, type QueryResultRow, types } from "pg";

import { config } from "../config.js";
import { appLogger } from "../lib/logger.js";

const dbLogger = appLogger.child({ module: "db" });

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

const pool = new Pool({
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
  dbLogger.error({ err: error }, "Unexpected PostgreSQL pool error");
});

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};
