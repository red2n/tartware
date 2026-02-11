import { Pool, type QueryResult, type QueryResultRow } from "pg";

import { config } from "../config.js";
import { appLogger } from "./logger.js";

const dbLogger = appLogger.child({ module: "db" });

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

pool.on("error", (error) => {
  dbLogger.error({ err: error }, "Unexpected PostgreSQL error");
});

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> => pool.query<T>(text, params);
