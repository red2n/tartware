import {
  Pool,
  type PoolClient,
  type QueryConfig,
  type QueryResult,
  type QueryResultRow,
  types,
} from "pg";

// ── Type parsers (global, idempotent) ──────────────────────────
let typeParsersRegistered = false;

function registerTypeParsers(): void {
  if (typeParsersRegistered) return;
  typeParsersRegistered = true;

  const parseBigInt = (value: string | null): bigint | null =>
    value === null ? null : BigInt(value);

  const parseTimestamp = (value: string | null): Date | null =>
    value === null ? null : new Date(`${value}Z`);

  types.setTypeParser(20, parseBigInt as (value: string) => unknown);
  types.setTypeParser(1114, parseTimestamp as (value: string) => unknown);
  types.setTypeParser(1184, parseTimestamp as (value: string) => unknown);
}

// ── Config shape (matches databaseSchema output) ───────────────
export interface DbPoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  max: number;
  idleTimeoutMillis: number;
  /** PostgreSQL statement_timeout in ms (0 = no limit). Default: 30 000 */
  statementTimeoutMs?: number;
}

// ── Logger interface (pino-compatible subset) ──────────────────
interface DbLogger {
  error: (obj: Record<string, unknown>, msg: string) => void;
}

interface ParentLogger {
  child: (bindings: Record<string, unknown>) => DbLogger;
}

// ── Return type ────────────────────────────────────────────────
export interface DbPool {
  /** Raw pool for services that need direct access. */
  pool: Pool;

  /** Execute a parameterised query (text + params, or a QueryConfig with optional `name` for prepared statements). */
  query: <T extends QueryResultRow = QueryResultRow>(
    textOrConfig: string | QueryConfig,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;

  /** Execute a parameterised query on an existing client (inside a transaction). */
  queryWithClient: <T extends QueryResultRow = QueryResultRow>(
    client: PoolClient,
    textOrConfig: string | QueryConfig,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;

  /** Run `fn` inside BEGIN / COMMIT with automatic ROLLBACK on error. */
  withTransaction: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;

  /** Drain the pool (graceful shutdown). */
  close: () => Promise<void>;
}

/**
 * Creates a PostgreSQL connection pool with standardised type parsers,
 * error handling, query helpers, and transaction support.
 */
export function createDbPool(dbConfig: DbPoolConfig, logger: ParentLogger): DbPool {
  registerTypeParsers();

  const dbLogger = logger.child({ module: "db" });

  const pool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl ? { rejectUnauthorized: false } : undefined,
    max: dbConfig.max,
    idleTimeoutMillis: dbConfig.idleTimeoutMillis,
    statement_timeout: dbConfig.statementTimeoutMs,
  });

  pool.on("error", (error: unknown) => {
    dbLogger.error({ err: error }, "Unexpected PostgreSQL pool error");
  });

  const query = async <T extends QueryResultRow = QueryResultRow>(
    textOrConfig: string | QueryConfig,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> => {
    if (typeof textOrConfig === "string") {
      return pool.query<T>(textOrConfig, params);
    }
    return pool.query<T>(textOrConfig);
  };

  const queryWithClient = async <T extends QueryResultRow = QueryResultRow>(
    client: PoolClient,
    textOrConfig: string | QueryConfig,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> => {
    if (typeof textOrConfig === "string") {
      return client.query<T>(textOrConfig, params);
    }
    return client.query<T>(textOrConfig);
  };

  const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    let transactionStarted = false;
    let rollbackError: unknown = null;

    try {
      await client.query("BEGIN");
      transactionStarted = true;
      const result = await fn(client);
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
      client.release(rollbackError !== null);
    }
  };

  const close = async (): Promise<void> => {
    await pool.end();
  };

  return { pool, query, queryWithClient, withTransaction, close };
}
