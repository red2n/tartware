import {
  buildAuthConfig,
  buildCommandCenterConfig,
  buildDbConfig,
  buildLogConfig,
  buildServiceInfo,
  databaseSchema,
  ensureAuthDefaults,
  initServiceIdentity,
  loadServiceConfig,
  parseBooleanEnv,
  parseNumberEnv,
  resolveKafkaConfig,
  validateProductionSecrets,
} from "@tartware/config";

initServiceIdentity("@tartware/billing-service");
ensureAuthDefaults();

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
  service: buildServiceInfo(configValues),
  port: configValues.PORT,
  host: configValues.HOST,
  log: buildLogConfig(configValues),
  db: buildDbConfig(configValues),
  auth: buildAuthConfig(),
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
  commandCenter: buildCommandCenterConfig("billing-service"),
  accounts: {
    commandCenter: buildCommandCenterConfig("accounts-service"),
  },
  finance: {
    commandCenter: buildCommandCenterConfig("finance-admin-service"),
  },
  roll: {
    shadowMode: parseBooleanEnv(process.env.SHADOW_MODE, true),
    kafka: rollKafkaFull,
    backfill: rollBackfill,
    dateRollScheduler: rollDateRollScheduler,
  },
};
