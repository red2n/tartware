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
export function ensureAuthDefaults(overrides?: {
	issuer?: string;
	audience?: string;
}): void {
	if (!process.env.AUTH_JWT_SECRET) {
		if (process.env.NODE_ENV === "production") {
			throw new Error("AUTH_JWT_SECRET must be set in production and cannot use a default value.");
		}
		process.env.AUTH_JWT_SECRET = "dev-secret-minimum-32-chars-change-me!";
	}
	process.env.AUTH_JWT_ISSUER =
		process.env.AUTH_JWT_ISSUER ?? (overrides?.issuer ?? "tartware-core");
	process.env.AUTH_JWT_AUDIENCE =
		process.env.AUTH_JWT_AUDIENCE ?? (overrides?.audience ?? "tartware");
}

/** Build the standard `config.auth` block from env vars. */
export function buildAuthConfig() {
	return {
		jwt: {
			secret: process.env.AUTH_JWT_SECRET ?? "dev-secret-minimum-32-chars-change-me!",
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
