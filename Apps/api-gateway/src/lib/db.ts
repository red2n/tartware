import { Pool, type PoolClient, type QueryResult, type QueryResultRow, types } from "pg";

import { dbConfig } from "../config.js";
import { gatewayLogger } from "../logger.js";

const dbLogger = gatewayLogger.child({ module: "db" });

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
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password,
  ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
  max: dbConfig.max,
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
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

export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  let transactionStarted = false;
  let rollbackError: unknown = null;

  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rbError) {
        rollbackError = rbError;
        dbLogger.error({ err: rbError }, "Transaction rollback failed");
      }
    }
    throw error;
  } finally {
    // Pass true to release() to signal error occurred, allowing pool to discard connection if needed
    client.release(rollbackError !== null);
  }
};
