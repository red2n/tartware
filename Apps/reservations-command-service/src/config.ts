import { config as loadEnv } from "dotenv";

loadEnv();

const env = process.env;

export const serviceConfig = {
  port: Number(env.RESERVATION_COMMAND_PORT ?? 3101),
  host: env.RESERVATION_COMMAND_HOST ?? "0.0.0.0",
  serviceId: env.RESERVATION_COMMAND_ID ?? "reservations-command-service",
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

export const reliabilityConfig = {
  retrySweepIntervalMs: Number(
    env.RESERVATION_COMMAND_RETRY_SWEEP_MS ?? 5000,
  ),
  retryBatchSize: Number(env.RESERVATION_COMMAND_RETRY_BATCH_SIZE ?? 25),
  retryBaseDelayMs: Number(env.RESERVATION_COMMAND_RETRY_BASE_DELAY_MS ?? 2000),
  retryMaxBackoffMs: Number(
    env.RESERVATION_COMMAND_RETRY_MAX_BACKOFF_MS ?? 60000,
  ),
  defaultMaxAttempts: Number(env.RESERVATION_COMMAND_MAX_ATTEMPTS ?? 6),
};
