/**
 * Service configuration helpers — eliminate boilerplate across all services.
 *
 * These helpers extract the common config assembly patterns that were
 * previously duplicated in every service's config.ts file.
 */
import type { z } from "zod";
import type { baseConfigSchema, databaseSchema } from "./index.js";
import { parseNumberEnv, parseNumberList } from "./kafka.js";

/**
 * Centralised dev-only fallback values. Any change here MUST also be added to
 * `INSECURE_LITERALS` in {@link ./index.ts} so production deployments fail fast
 * if a value ever leaks past the env layer.
 */
const DEV_JWT_SECRET = "dev-secret-minimum-32-chars-change-me!";
const DEV_DEFAULT_PASSWORD = "TempPass123";

/** Throw with a consistent, actionable error when a required prod secret is missing. */
function requireInProduction(name: string): never {
  throw new Error(
    `${name} must be set in production and cannot use a default value. ` +
      `Provide it via environment variable or secret manager.`,
  );
}

/**
 * Set SERVICE_NAME and SERVICE_VERSION env vars if not already defined.
 * Must be called before `loadServiceConfig()`.
 */
export function initServiceIdentity(name: string, version = "0.1.0"): void {
  process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? name;
  process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? version;
}

/**
 * Ensure AUTH_JWT_SECRET is set. Throws in production if missing;
 * falls back to a dev-only default otherwise.
 */
export function ensureAuthDefaults(overrides?: { issuer?: string; audience?: string }): void {
  if (!process.env.AUTH_JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
      requireInProduction("AUTH_JWT_SECRET");
    }
    process.env.AUTH_JWT_SECRET = DEV_JWT_SECRET;
  }
  process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? overrides?.issuer ?? "tartware-core";
  process.env.AUTH_JWT_AUDIENCE =
    process.env.AUTH_JWT_AUDIENCE ?? overrides?.audience ?? "tartware";
}

/**
 * Ensure AUTH_DEFAULT_PASSWORD (used to seed the bootstrap admin) is set.
 * Throws in production if missing; falls back to a dev-only default otherwise.
 */
export function ensureDefaultPassword(): void {
  if (!process.env.AUTH_DEFAULT_PASSWORD) {
    if (process.env.NODE_ENV === "production") {
      requireInProduction("AUTH_DEFAULT_PASSWORD");
    }
    process.env.AUTH_DEFAULT_PASSWORD = DEV_DEFAULT_PASSWORD;
  }
}

/**
 * Ensure SERVICE_AUTH_PASSWORD (used for service-to-service auth) is set.
 * Throws in production if missing; falls back to a dev-only default otherwise.
 */
export function ensureServiceAuthPassword(): void {
  if (!process.env.SERVICE_AUTH_PASSWORD) {
    if (process.env.NODE_ENV === "production") {
      requireInProduction("SERVICE_AUTH_PASSWORD");
    }
    process.env.SERVICE_AUTH_PASSWORD = DEV_DEFAULT_PASSWORD;
  }
}

/**
 * Build the standard `config.auth` block from env vars.
 * Assumes {@link ensureAuthDefaults} has already run, so AUTH_JWT_SECRET is guaranteed set.
 */
export function buildAuthConfig() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    requireInProduction("AUTH_JWT_SECRET");
  }
  return {
    jwt: {
      secret,
      issuer: process.env.AUTH_JWT_ISSUER ?? "tartware-core",
      audience: process.env.AUTH_JWT_AUDIENCE ?? "tartware",
    },
  };
}

/** Build command-center Kafka consumer config from env vars. */
export function buildCommandCenterConfig(serviceId: string) {
  const shortName = serviceId.replace(/-service$/, "");
  return {
    topic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
    consumerGroupId:
      process.env.COMMAND_CENTER_CONSUMER_GROUP ?? `${shortName}-command-center-consumer`,
    targetServiceId: process.env.COMMAND_CENTER_TARGET_SERVICE_ID ?? serviceId,
    maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
    dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
    maxRetries: parseNumberEnv(process.env.KAFKA_MAX_RETRIES, 3),
    retryBackoffMs: parseNumberEnv(process.env.KAFKA_RETRY_BACKOFF_MS, 1000),
    retryScheduleMs: parseNumberList(process.env.KAFKA_RETRY_SCHEDULE_MS),
  };
}

/** Build the standard `config.db` block from parsed config values. */
export function buildDbConfig(configValues: z.infer<typeof databaseSchema>) {
  return {
    host: configValues.DB_HOST,
    port: configValues.DB_PORT,
    database: configValues.DB_NAME,
    user: configValues.DB_USER,
    password: configValues.DB_PASSWORD,
    ssl: configValues.DB_SSL,
    max: configValues.DB_POOL_MAX,
    idleTimeoutMillis: configValues.DB_POOL_IDLE_TIMEOUT_MS,
    statementTimeoutMs: configValues.DB_STATEMENT_TIMEOUT_MS,
  };
}

/** Build the standard `config.log` block from parsed config values. */
export function buildLogConfig(configValues: z.infer<typeof baseConfigSchema>) {
  return {
    level: configValues.LOG_LEVEL,
    pretty: configValues.LOG_PRETTY,
    requestLogging: configValues.LOG_REQUESTS,
  };
}

/** Build the standard `config.service` block from parsed config values. */
export function buildServiceInfo(configValues: z.infer<typeof baseConfigSchema>) {
  return {
    name: configValues.SERVICE_NAME,
    version: configValues.SERVICE_VERSION,
  };
}
