import {
  databaseSchema,
  loadServiceConfig,
  parseBooleanEnv,
  parseNumberEnv,
  parseNumberList,
  resolveKafkaConfig,
  validateProductionSecrets,
} from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/billing-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

if (!process.env.AUTH_JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET must be set in production and cannot use a default value.");
  }
  process.env.AUTH_JWT_SECRET = "dev-secret-minimum-32-chars-change-me!";
}
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "tartware-core";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware";

const configValues = loadServiceConfig(databaseSchema);
validateProductionSecrets({
  ...configValues,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  AUTH_DEFAULT_PASSWORD: process.env.AUTH_DEFAULT_PASSWORD,
});
const billingDataRetentionDays = parseNumberEnv(
  process.env.COMPLIANCE_BILLING_DATA_RETENTION_DAYS,
  2555,
);
const requireBillingEncryption = parseBooleanEnv(
  process.env.COMPLIANCE_REQUIRE_BILLING_ENCRYPTION,
  true,
);
const billingEncryptionKey = process.env.BILLING_DATA_ENCRYPTION_KEY ?? "local-dev-billing-key";

const kafka = resolveKafkaConfig({
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-billing-service",
  defaultPrimaryBroker: "localhost:29092",
});

const commandCenter = {
  topic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId: process.env.COMMAND_CENTER_CONSUMER_GROUP ?? "billing-command-center-consumer",
  targetServiceId: process.env.COMMAND_CENTER_TARGET_SERVICE_ID ?? "billing-service",
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
  maxRetries: parseNumberEnv(process.env.KAFKA_MAX_RETRIES, 3),
  retryBackoffMs: parseNumberEnv(process.env.KAFKA_RETRY_BACKOFF_MS, 1000),
  retryScheduleMs: parseNumberList(process.env.KAFKA_RETRY_SCHEDULE_MS),
};

// Accounts-service consumer group (absorbed Phase 6)
const accountsCommandCenter = {
  topic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId:
    process.env.ACCOUNTS_COMMAND_CENTER_CONSUMER_GROUP ?? "accounts-command-center-consumer",
  targetServiceId: process.env.ACCOUNTS_COMMAND_CENTER_TARGET_SERVICE_ID ?? "accounts-service",
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
  maxRetries: parseNumberEnv(process.env.KAFKA_MAX_RETRIES, 3),
  retryBackoffMs: parseNumberEnv(process.env.KAFKA_RETRY_BACKOFF_MS, 1000),
  retryScheduleMs: parseNumberList(process.env.KAFKA_RETRY_SCHEDULE_MS),
};

// Finance-admin-service consumer group (absorbed Phase 6)
const financeAdminCommandCenter = {
  topic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId:
    process.env.FINANCE_ADMIN_COMMAND_CENTER_CONSUMER_GROUP ??
    "finance-admin-command-center-consumer",
  targetServiceId:
    process.env.FINANCE_ADMIN_COMMAND_CENTER_TARGET_SERVICE_ID ?? "finance-admin-service",
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
  maxRetries: parseNumberEnv(process.env.KAFKA_MAX_RETRIES, 3),
  retryBackoffMs: parseNumberEnv(process.env.KAFKA_RETRY_BACKOFF_MS, 1000),
  retryScheduleMs: parseNumberList(process.env.KAFKA_RETRY_SCHEDULE_MS),
};

// Roll-service config (absorbed Phase 6)
const rollKafka = resolveKafkaConfig({
  clientId: process.env.ROLL_KAFKA_CLIENT_ID ?? "tartware-roll-service",
  defaultPrimaryBroker: "localhost:29092",
});

const rollKafkaFull = {
  ...rollKafka,
  topic: process.env.RESERVATION_EVENTS_TOPIC ?? "reservations.events",
  consumerGroupId: process.env.ROLL_SERVICE_CONSUMER_GROUP ?? "roll-service-shadow",
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  consumerEnabled: parseBooleanEnv(process.env.ROLL_SERVICE_CONSUMER_ENABLED, true),
};

const rollBackfill = {
  enabled: parseBooleanEnv(process.env.ROLL_SERVICE_BACKFILL_ENABLED, true),
  batchSize: parseNumberEnv(process.env.ROLL_SERVICE_BACKFILL_BATCH_SIZE, 500),
  intervalMs: parseNumberEnv(process.env.ROLL_SERVICE_BACKFILL_INTERVAL_MS, 60000),
};

const rollDateRollScheduler = {
  enabled: parseBooleanEnv(process.env.DATE_ROLL_SCHEDULER_ENABLED, true),
  checkIntervalMs: parseNumberEnv(process.env.DATE_ROLL_CHECK_INTERVAL_MS, 60000),
  commandTopic: process.env.COMMAND_TOPIC ?? "commands.primary",
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
    statementTimeoutMs: configValues.DB_STATEMENT_TIMEOUT_MS,
  },
  auth: {
    jwt: {
      secret: process.env.AUTH_JWT_SECRET ?? "dev-secret-minimum-32-chars-change-me!",
      issuer: process.env.AUTH_JWT_ISSUER ?? "tartware-core",
      audience: process.env.AUTH_JWT_AUDIENCE ?? "tartware",
    },
  },
  compliance: {
    retention: {
      billingDataDays: billingDataRetentionDays,
    },
    encryption: {
      requireBillingEncryption,
      billingDataKey: billingEncryptionKey,
    },
  },
  kafka,
  commandCenter,
  accounts: {
    commandCenter: accountsCommandCenter,
  },
  finance: {
    commandCenter: financeAdminCommandCenter,
  },
  roll: {
    shadowMode: parseBooleanEnv(process.env.SHADOW_MODE, true),
    kafka: rollKafkaFull,
    backfill: rollBackfill,
    dateRollScheduler: rollDateRollScheduler,
  },
};
