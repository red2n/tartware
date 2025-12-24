import { databaseSchema, loadServiceConfig } from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/roll-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

const toNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
};

const configValues = loadServiceConfig(databaseSchema);

const kafka = {
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-roll-service",
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:29092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean),
  topic: process.env.RESERVATION_EVENTS_TOPIC ?? "reservations.events",
  consumerGroupId:
    process.env.ROLL_SERVICE_CONSUMER_GROUP ?? "roll-service-shadow",
  maxBatchBytes: toNumber(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  consumerEnabled: toBoolean(process.env.ROLL_SERVICE_CONSUMER_ENABLED, true),
};

const backfill = {
  enabled: toBoolean(process.env.ROLL_SERVICE_BACKFILL_ENABLED, true),
  batchSize: toNumber(process.env.ROLL_SERVICE_BACKFILL_BATCH_SIZE, 500),
  intervalMs: toNumber(process.env.ROLL_SERVICE_BACKFILL_INTERVAL_MS, 60000),
};

export const config = {
  service: {
    name: configValues.SERVICE_NAME,
    version: configValues.SERVICE_VERSION,
  },
  port: configValues.PORT,
  host: configValues.HOST,
  log: {
    level: configValues.LOG_LEVEL,
    pretty: configValues.LOG_PRETTY,
    requestLogging: configValues.LOG_REQUESTS,
  },
  db: {
    host: configValues.DB_HOST,
    port: configValues.DB_PORT,
    database: configValues.DB_NAME,
    user: configValues.DB_USER,
    password: configValues.DB_PASSWORD,
    ssl: configValues.DB_SSL,
    max: configValues.DB_POOL_MAX,
    idleTimeoutMillis: configValues.DB_POOL_IDLE_TIMEOUT_MS,
  },
  kafka,
  backfill,
  shadowMode: toBoolean(process.env.SHADOW_MODE, true),
};
