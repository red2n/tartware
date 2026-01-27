import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";

import { databaseConfig } from "../config.js";

const pool = new Pool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  database: databaseConfig.database,
  user: databaseConfig.user,
  password: databaseConfig.password,
  ssl: databaseConfig.ssl ? { rejectUnauthorized: false } : undefined,
  max: databaseConfig.max,
  idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error", error);
});

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};

/**
 * Executes the provided callback within a PostgreSQL transaction.
 */
export const withTransaction = async <T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  let transactionStarted = false;
  let rollbackError: unknown = null;

  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rbError) {
        rollbackError = rbError;
        console.error("Transaction rollback failed", rbError);
      }
    }
    throw error;
  } finally {
    // Pass true to release() to signal error occurred, allowing pool to discard connection if needed
    client.release(rollbackError !== null);
  }
};
