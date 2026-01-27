import {
  databaseSchema,
  loadServiceConfig,
  parseNumberEnv,
  parseNumberList,
  resolveKafkaConfig,
} from "@tartware/config";

process.env.SERVICE_NAME =
  process.env.SERVICE_NAME ?? "@tartware/housekeeping-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";
// Dev default - must be overridden in production via env var
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET ?? "local-dev-secret-minimum-32-chars!";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "tartware-core";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware";

const configValues = loadServiceConfig(databaseSchema);

const kafka = resolveKafkaConfig({
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-housekeeping-service",
  defaultPrimaryBroker: "localhost:29092",
});

const commandCenter = {
  topic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId:
    process.env.COMMAND_CENTER_CONSUMER_GROUP ??
    "housekeeping-command-center-consumer",
  targetServiceId:
    process.env.COMMAND_CENTER_TARGET_SERVICE_ID ?? "housekeeping-service",
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
  maxRetries: parseNumberEnv(process.env.KAFKA_MAX_RETRIES, 3),
  retryBackoffMs: parseNumberEnv(process.env.KAFKA_RETRY_BACKOFF_MS, 1000),
  retryScheduleMs: parseNumberList(process.env.KAFKA_RETRY_SCHEDULE_MS),
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
  auth: {
    jwt: {
      secret:
        process.env.AUTH_JWT_SECRET ?? "local-dev-secret-minimum-32-chars!",
      issuer: process.env.AUTH_JWT_ISSUER ?? "tartware-core",
      audience: process.env.AUTH_JWT_AUDIENCE ?? "tartware",
    },
  },
  kafka,
  commandCenter,
};
