import { Pool, type QueryResult, type QueryResultRow } from "pg";

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
