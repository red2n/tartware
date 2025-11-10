import { config as loadEnv } from "dotenv";

// Load .env file
loadEnv();

type EnvRecord = Record<string, string | undefined>;

const env = ((globalThis as { process?: { env?: EnvRecord } }).process?.env ?? {}) as EnvRecord;

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return fallback;
};

export const config = {
  port: toNumber(env.PORT, 3000),
  host: env.HOST ?? "0.0.0.0",
  log: {
    level: env.LOG_LEVEL ?? "info",
    pretty: toBoolean(env.LOG_PRETTY, true),
    requestLogging: toBoolean(env.LOG_REQUESTS, true),
  },
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
  redis: {
    host: env.REDIS_HOST ?? "127.0.0.1",
    port: toNumber(env.REDIS_PORT, 6379),
    password: env.REDIS_PASSWORD,
    db: toNumber(env.REDIS_DB, 0),
    keyPrefix: env.REDIS_KEY_PREFIX ?? "tartware:",
    enabled: toBoolean(env.REDIS_ENABLED, true),
    ttl: {
      default: toNumber(env.REDIS_TTL_DEFAULT, 3600), // 1 hour
      user: toNumber(env.REDIS_TTL_USER, 1800), // 30 minutes
      tenant: toNumber(env.REDIS_TTL_TENANT, 3600), // 1 hour
      bloom: toNumber(env.REDIS_TTL_BLOOM, 86400), // 24 hours
    },
  },
};
