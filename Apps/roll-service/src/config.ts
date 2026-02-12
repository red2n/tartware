import {
  databaseSchema,
  loadServiceConfig,
  parseBooleanEnv,
  parseNumberEnv,
  resolveKafkaConfig,
} from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/roll-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

const configValues = loadServiceConfig(databaseSchema);

const resolvedKafka = resolveKafkaConfig({
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-roll-service",
  defaultPrimaryBroker: "localhost:29092",
});

const kafka = {
  ...resolvedKafka,
  topic: process.env.RESERVATION_EVENTS_TOPIC ?? "reservations.events",
  consumerGroupId: process.env.ROLL_SERVICE_CONSUMER_GROUP ?? "roll-service-shadow",
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  consumerEnabled: parseBooleanEnv(process.env.ROLL_SERVICE_CONSUMER_ENABLED, true),
};

const backfill = {
  enabled: parseBooleanEnv(process.env.ROLL_SERVICE_BACKFILL_ENABLED, true),
  batchSize: parseNumberEnv(process.env.ROLL_SERVICE_BACKFILL_BATCH_SIZE, 500),
  intervalMs: parseNumberEnv(process.env.ROLL_SERVICE_BACKFILL_INTERVAL_MS, 60000),
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
  shadowMode: parseBooleanEnv(process.env.SHADOW_MODE, true),
};
