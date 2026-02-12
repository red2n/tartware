import {
  coreAuthSchema,
  databaseSchema,
  loadServiceConfig,
  validateProductionSecrets,
} from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/command-center-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

if (!process.env.AUTH_JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET must be set in production and cannot use a default value.");
  }
  process.env.AUTH_JWT_SECRET = "dev-secret-minimum-32-chars-change-me!";
}
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "@tartware/core-service:system";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware-core";

const toNumber = (value: string | undefined, fallback: number): number => {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const parseBrokerList = (value: string | undefined, fallback?: string): string[] =>
  (value ?? fallback ?? "")
    .split(",")
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

const configValues = loadServiceConfig(databaseSchema.merge(coreAuthSchema));
validateProductionSecrets(configValues);

const runtimeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
const isProduction = runtimeEnv === "production";

const primaryKafkaBrokers = parseBrokerList(
  process.env.COMMAND_CENTER_KAFKA_BROKERS,
  "localhost:29092",
);
const usedDefaultPrimary = (process.env.COMMAND_CENTER_KAFKA_BROKERS ?? "").trim().length === 0;
const failoverKafkaBrokers = parseBrokerList(
  process.env.COMMAND_CENTER_KAFKA_FAILOVER_BROKERS ?? process.env.KAFKA_FAILOVER_BROKERS,
);
const requestedKafkaCluster = (
  process.env.COMMAND_CENTER_KAFKA_ACTIVE_CLUSTER ??
  process.env.KAFKA_ACTIVE_CLUSTER ??
  "primary"
).toLowerCase();
const kafkaFailoverEnabled = parseBoolean(
  process.env.COMMAND_CENTER_KAFKA_FAILOVER_ENABLED ?? process.env.KAFKA_FAILOVER_ENABLED,
  false,
);
const useKafkaFailover =
  (requestedKafkaCluster === "failover" || kafkaFailoverEnabled) && failoverKafkaBrokers.length > 0;

let kafkaActiveCluster: "primary" | "failover" = "primary";
let resolvedKafkaBrokers = primaryKafkaBrokers;

if (useKafkaFailover) {
  resolvedKafkaBrokers = failoverKafkaBrokers;
  kafkaActiveCluster = "failover";
} else if (primaryKafkaBrokers.length === 0 && failoverKafkaBrokers.length > 0) {
  resolvedKafkaBrokers = failoverKafkaBrokers;
  kafkaActiveCluster = "failover";
}

if (primaryKafkaBrokers.length === 0 && failoverKafkaBrokers.length === 0) {
  throw new Error(
    "COMMAND_CENTER_KAFKA_BROKERS or COMMAND_CENTER_KAFKA_FAILOVER_BROKERS must be set",
  );
}

if (useKafkaFailover && failoverKafkaBrokers.length === 0) {
  throw new Error("Failover requested/enabled but COMMAND_CENTER_KAFKA_FAILOVER_BROKERS is empty");
}

if (kafkaActiveCluster === "primary" && primaryKafkaBrokers.length === 0) {
  throw new Error("Primary cluster requested but COMMAND_CENTER_KAFKA_BROKERS is empty");
}

if (isProduction && usedDefaultPrimary && kafkaActiveCluster === "primary") {
  throw new Error(
    "Production requires explicit COMMAND_CENTER_KAFKA_BROKERS; default localhost fallback is disabled",
  );
}

const kafka = {
  clientId: process.env.COMMAND_CENTER_KAFKA_CLIENT_ID ?? "tartware-command-center",
  brokers: resolvedKafkaBrokers,
  primaryBrokers: primaryKafkaBrokers,
  failoverBrokers: failoverKafkaBrokers,
  activeCluster: kafkaActiveCluster,
  topic: process.env.COMMAND_CENTER_KAFKA_TOPIC ?? "commands.primary",
  dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
};

const outbox = {
  workerId: process.env.COMMAND_CENTER_OUTBOX_WORKER_ID ?? `${configValues.SERVICE_NAME}-outbox`,
  pollIntervalMs: toNumber(process.env.COMMAND_CENTER_OUTBOX_POLL_INTERVAL_MS, 2000),
  batchSize: toNumber(process.env.COMMAND_CENTER_OUTBOX_BATCH_SIZE, 25),
  lockTimeoutMs: toNumber(process.env.COMMAND_CENTER_OUTBOX_LOCK_TIMEOUT_MS, 30000),
  maxRetries: toNumber(process.env.COMMAND_CENTER_OUTBOX_MAX_RETRIES, 5),
  retryBackoffMs: toNumber(process.env.COMMAND_CENTER_OUTBOX_RETRY_BACKOFF_MS, 5000),
  tenantThrottleMs: toNumber(process.env.COMMAND_CENTER_OUTBOX_TENANT_THROTTLE_MS, 0),
  tenantJitterMs: toNumber(process.env.COMMAND_CENTER_OUTBOX_TENANT_JITTER_MS, 0),
  tenantThrottleCleanupMs: toNumber(
    process.env.COMMAND_CENTER_OUTBOX_TENANT_THROTTLE_CLEANUP_MS,
    60_000,
  ),
};

const registry = {
  refreshIntervalMs: toNumber(process.env.COMMAND_REGISTRY_REFRESH_MS, 30000),
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
      secret: configValues.AUTH_JWT_SECRET,
      issuer: configValues.AUTH_JWT_ISSUER,
      audience: configValues.AUTH_JWT_AUDIENCE,
    },
  },
  kafka,
  outbox,
  registry,
};
