import {
  coreAuthSchema,
  databaseSchema,
  loadServiceConfig,
  parseNumberEnv,
  resolveKafkaConfig,
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

const configValues = loadServiceConfig(databaseSchema.merge(coreAuthSchema));
validateProductionSecrets(configValues);

const kafkaBase = resolveKafkaConfig({
  clientId: process.env.COMMAND_CENTER_KAFKA_CLIENT_ID ?? "tartware-command-center",
  defaultPrimaryBroker: "localhost:29092",
  envKeys: {
    brokers: "COMMAND_CENTER_KAFKA_BROKERS",
    failoverBrokers: ["COMMAND_CENTER_KAFKA_FAILOVER_BROKERS", "KAFKA_FAILOVER_BROKERS"],
    activeCluster: ["COMMAND_CENTER_KAFKA_ACTIVE_CLUSTER", "KAFKA_ACTIVE_CLUSTER"],
    failoverEnabled: ["COMMAND_CENTER_KAFKA_FAILOVER_ENABLED", "KAFKA_FAILOVER_ENABLED"],
  },
});

const kafka = {
  ...kafkaBase,
  topic: process.env.COMMAND_CENTER_KAFKA_TOPIC ?? "commands.primary",
  dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
};

const outbox = {
  workerId: process.env.COMMAND_CENTER_OUTBOX_WORKER_ID ?? `${configValues.SERVICE_NAME}-outbox`,
  pollIntervalMs: parseNumberEnv(process.env.COMMAND_CENTER_OUTBOX_POLL_INTERVAL_MS, 2000),
  batchSize: parseNumberEnv(process.env.COMMAND_CENTER_OUTBOX_BATCH_SIZE, 25),
  lockTimeoutMs: parseNumberEnv(process.env.COMMAND_CENTER_OUTBOX_LOCK_TIMEOUT_MS, 30000),
  maxRetries: parseNumberEnv(process.env.COMMAND_CENTER_OUTBOX_MAX_RETRIES, 5),
  retryBackoffMs: parseNumberEnv(process.env.COMMAND_CENTER_OUTBOX_RETRY_BACKOFF_MS, 5000),
  tenantThrottleMs: parseNumberEnv(process.env.COMMAND_CENTER_OUTBOX_TENANT_THROTTLE_MS, 0),
  tenantJitterMs: parseNumberEnv(process.env.COMMAND_CENTER_OUTBOX_TENANT_JITTER_MS, 0),
  tenantThrottleCleanupMs: parseNumberEnv(
    process.env.COMMAND_CENTER_OUTBOX_TENANT_THROTTLE_CLEANUP_MS,
    60_000,
  ),
};

const registry = {
  refreshIntervalMs: parseNumberEnv(process.env.COMMAND_REGISTRY_REFRESH_MS, 30000),
  heartbeatTtlMs: parseNumberEnv(process.env.REGISTRY_HEARTBEAT_TTL_MS, 120_000),
  sweepIntervalMs: parseNumberEnv(process.env.REGISTRY_SWEEP_INTERVAL_MS, 30_000),
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
