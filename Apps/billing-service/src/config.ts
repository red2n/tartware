import { databaseSchema, loadServiceConfig } from "@tartware/config";

process.env.SERVICE_NAME =
  process.env.SERVICE_NAME ?? "@tartware/billing-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";
process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "local-dev-secret";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "tartware-core";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware";

const toNumber = (value: string | undefined, fallback: number): number => {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const FALSEY_VALUES = new Set(["0", "false", "no", "off"]);
const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return !FALSEY_VALUES.has(value.toLowerCase());
};

const parseBrokerList = (
  value: string | undefined,
  fallback?: string,
): string[] =>
  (value ?? fallback ?? "")
    .split(",")
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

const parseNumberList = (value: string | undefined): number[] =>
  (value ?? "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);

const configValues = loadServiceConfig(databaseSchema);
const runtimeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
const isProduction = runtimeEnv === "production";
const billingDataRetentionDays = toNumber(
  process.env.COMPLIANCE_BILLING_DATA_RETENTION_DAYS,
  2555,
);
const requireBillingEncryption = toBoolean(
  process.env.COMPLIANCE_REQUIRE_BILLING_ENCRYPTION,
  true,
);
const billingEncryptionKey =
  process.env.BILLING_DATA_ENCRYPTION_KEY ?? "local-dev-billing-key";

const primaryKafkaBrokers = parseBrokerList(
  process.env.KAFKA_BROKERS,
  "localhost:29092",
);
const usedDefaultPrimary =
  (process.env.KAFKA_BROKERS ?? "").trim().length === 0;
const failoverKafkaBrokers = parseBrokerList(
  process.env.KAFKA_FAILOVER_BROKERS,
);
const requestedCluster = (
  process.env.KAFKA_ACTIVE_CLUSTER ?? "primary"
).toLowerCase();
const failoverToggle = toBoolean(process.env.KAFKA_FAILOVER_ENABLED, false);
const useFailover =
  (requestedCluster === "failover" || failoverToggle) &&
  failoverKafkaBrokers.length > 0;
const resolvedKafkaBrokers =
  useFailover && failoverKafkaBrokers.length > 0
    ? failoverKafkaBrokers
    : primaryKafkaBrokers.length > 0
      ? primaryKafkaBrokers
      : failoverKafkaBrokers;
const activeKafkaCluster =
  resolvedKafkaBrokers === failoverKafkaBrokers &&
  resolvedKafkaBrokers.length > 0
    ? "failover"
    : "primary";

if (primaryKafkaBrokers.length === 0 && failoverKafkaBrokers.length === 0) {
  throw new Error("KAFKA_BROKERS or KAFKA_FAILOVER_BROKERS must be set");
}

if (useFailover && failoverKafkaBrokers.length === 0) {
  throw new Error(
    "Failover requested/enabled but KAFKA_FAILOVER_BROKERS is empty",
  );
}

if (activeKafkaCluster === "primary" && primaryKafkaBrokers.length === 0) {
  throw new Error("Primary cluster requested but KAFKA_BROKERS is empty");
}

if (isProduction && usedDefaultPrimary && activeKafkaCluster === "primary") {
  throw new Error(
    "Production requires explicit KAFKA_BROKERS; default localhost fallback is disabled",
  );
}

const kafka = {
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-billing-service",
  brokers: resolvedKafkaBrokers,
  primaryBrokers: primaryKafkaBrokers,
  failoverBrokers: failoverKafkaBrokers,
  activeCluster: activeKafkaCluster,
};

const commandCenter = {
  topic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId:
    process.env.COMMAND_CENTER_CONSUMER_GROUP ??
    "billing-command-center-consumer",
  targetServiceId:
    process.env.COMMAND_CENTER_TARGET_SERVICE_ID ?? "billing-service",
  maxBatchBytes: toNumber(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
  maxRetries: toNumber(process.env.KAFKA_MAX_RETRIES, 3),
  retryBackoffMs: toNumber(process.env.KAFKA_RETRY_BACKOFF_MS, 1000),
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
      secret: process.env.AUTH_JWT_SECRET ?? "local-dev-secret",
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
};
