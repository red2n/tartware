import { config as loadEnv } from "dotenv";

loadEnv();

const env = process.env;

const parseBoolean = (
  value: string | undefined,
  fallback: boolean,
): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
};

export const serviceConfig = {
  port: Number(env.RESERVATION_COMMAND_PORT ?? 3101),
  host: env.RESERVATION_COMMAND_HOST ?? "0.0.0.0",
  serviceId: env.RESERVATION_COMMAND_ID ?? "reservations-command-service",
  requestLogging: parseBoolean(env.RESERVATION_COMMAND_LOG_REQUESTS, false),
};

export const kafkaConfig = {
  clientId: env.KAFKA_CLIENT_ID ?? "tartware-reservations-command",
  brokers: (env.KAFKA_BROKERS ?? "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0),
  topic: env.KAFKA_RESERVATION_TOPIC ?? "reservations.events",
  consumerGroupId:
    env.KAFKA_RESERVATION_CONSUMER_GROUP ?? "reservations-event-consumers",
  dlqTopic: env.RESERVATION_DLQ_TOPIC ?? "reservations.events.dlq",
  maxRetries: Number(env.KAFKA_MAX_RETRIES ?? 3),
  retryBackoffMs: Number(env.KAFKA_RETRY_BACKOFF_MS ?? 1000),
  maxBatchBytes: Number(env.KAFKA_MAX_BATCH_BYTES ?? 1048576),
};

export const outboxConfig = {
  workerId: env.OUTBOX_WORKER_ID ?? `${serviceConfig.serviceId}-outbox`,
  pollIntervalMs: Number(env.OUTBOX_POLL_INTERVAL_MS ?? 2000),
  batchSize: Number(env.OUTBOX_BATCH_SIZE ?? 25),
  lockTimeoutMs: Number(env.OUTBOX_LOCK_TIMEOUT_MS ?? 30000),
  maxRetries: Number(env.OUTBOX_MAX_RETRIES ?? 5),
  retryBackoffMs: Number(env.OUTBOX_RETRY_BACKOFF_MS ?? 5000),
};

export const databaseConfig = {
  host: env.DB_HOST ?? "127.0.0.1",
  port: Number(env.DB_PORT ?? 5432),
  database: env.DB_NAME ?? "tartware",
  user: env.DB_USER ?? "postgres",
  password: env.DB_PASSWORD ?? "postgres",
  ssl: (env.DB_SSL ?? "false").toLowerCase() === "true",
  max: Number(env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(env.DB_POOL_IDLE_TIMEOUT_MS ?? 30000),
};
