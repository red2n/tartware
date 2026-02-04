import pg from "pg";

import { config } from "../config.js";
import { appLogger } from "./logger.js";

const { Pool } = pg;

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
});

pool.on("error", (err) => {
  appLogger.error({ err }, "Unexpected database pool error");
});

pool.on("connect", () => {
  appLogger.debug("New database connection established");
});

/**
 * Execute a query with automatic connection management.
 */
export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = performance.now();
  const result = await pool.query<T>(text, params);
  const duration = performance.now() - start;
  appLogger.debug(
    {
      query: text.substring(0, 100),
      rows: result.rowCount,
      durationMs: duration.toFixed(2),
    },
    "Query executed",
  );
  return result;
}

/**
 * Get a client from the pool for transactions.
 */
export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

/**
 * Gracefully close the pool.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
