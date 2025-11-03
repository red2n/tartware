type EnvRecord = Record<string, string | undefined>;

const env = ((globalThis as { process?: { env?: EnvRecord } }).process?.env ?? {}) as EnvRecord;

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toNumber(env.PORT, 3000),
  host: env.HOST ?? "0.0.0.0",
  db: {
    host: env.DB_HOST ?? "127.0.0.1",
    port: toNumber(env.DB_PORT, 5432),
    database: env.DB_NAME ?? "tartware",
    user: env.DB_USER ?? "postgres",
    password: env.DB_PASSWORD ?? "postgres",
    ssl: (env.DB_SSL ?? "false").toLowerCase() === "true",
    max: toNumber(env.DB_POOL_MAX, 10),
    idleTimeoutMillis: toNumber(env.DB_POOL_IDLE_TIMEOUT_MS, 30000),
  },
};
