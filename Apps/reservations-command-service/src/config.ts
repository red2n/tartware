import {
  databaseSchema,
  loadServiceConfig,
  parseBooleanEnv,
  parseNumberEnv,
  parseNumberList,
  resolveKafkaConfig,
} from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/reservations-command-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

const configValues = loadServiceConfig(databaseSchema);

const kafka = resolveKafkaConfig({
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-reservations-command",
  defaultPrimaryBroker: "localhost:29092",
});

const defaultRetryScheduleMs = parseNumberList(process.env.KAFKA_RETRY_SCHEDULE_MS);

export const serviceConfig = {
  port: configValues.PORT,
  host: configValues.HOST,
  serviceId: process.env.RESERVATION_COMMAND_ID ?? "reservations-command-service",
  requestLogging: parseBooleanEnv(process.env.RESERVATION_COMMAND_LOG_REQUESTS, false),
};

export const kafkaConfig = {
  ...kafka,
  topic: process.env.KAFKA_RESERVATION_TOPIC ?? "reservations.events",
  consumerGroupId: process.env.KAFKA_RESERVATION_CONSUMER_GROUP ?? "reservations-event-consumers",
  dlqTopic: process.env.RESERVATION_DLQ_TOPIC ?? "reservations.events.dlq",
  maxRetries: parseNumberEnv(process.env.KAFKA_MAX_RETRIES, 3),
  retryBackoffMs: parseNumberEnv(process.env.KAFKA_RETRY_BACKOFF_MS, 1000),
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  retryScheduleMs: defaultRetryScheduleMs.length > 0 ? defaultRetryScheduleMs : [1000, 5000, 30000],
};

export const outboxConfig = {
  workerId: process.env.OUTBOX_WORKER_ID ?? `${serviceConfig.serviceId}-outbox`,
  pollIntervalMs: parseNumberEnv(process.env.OUTBOX_POLL_INTERVAL_MS, 2000),
  batchSize: parseNumberEnv(process.env.OUTBOX_BATCH_SIZE, 25),
  lockTimeoutMs: parseNumberEnv(process.env.OUTBOX_LOCK_TIMEOUT_MS, 30000),
  maxRetries: parseNumberEnv(process.env.OUTBOX_MAX_RETRIES, 5),
  retryBackoffMs: parseNumberEnv(process.env.OUTBOX_RETRY_BACKOFF_MS, 5000),
  tenantThrottleMs: parseNumberEnv(process.env.OUTBOX_TENANT_THROTTLE_MS, 0),
  tenantJitterMs: parseNumberEnv(process.env.OUTBOX_TENANT_JITTER_MS, 0),
  tenantThrottleCleanupMs: parseNumberEnv(process.env.OUTBOX_TENANT_THROTTLE_CLEANUP_MS, 60_000),
};

export const reliabilityConfig = {
  stalledThresholdSeconds: parseNumberEnv(process.env.RELIABILITY_STALLED_THRESHOLD_SECONDS, 120),
  consumerStaleSeconds: parseNumberEnv(process.env.RELIABILITY_CONSUMER_STALE_SECONDS, 60),
  outboxWarnThreshold: parseNumberEnv(process.env.RELIABILITY_OUTBOX_WARN_THRESHOLD, 100),
  outboxCriticalThreshold: parseNumberEnv(process.env.RELIABILITY_OUTBOX_CRITICAL_THRESHOLD, 500),
  dlqWarnThreshold: parseNumberEnv(process.env.RELIABILITY_DLQ_WARN_THRESHOLD, 10),
  dlqCriticalThreshold: parseNumberEnv(process.env.RELIABILITY_DLQ_CRITICAL_THRESHOLD, 50),
};

export const databaseConfig = {
  host: configValues.DB_HOST,
  port: configValues.DB_PORT,
  database: configValues.DB_NAME,
  user: configValues.DB_USER,
  password: configValues.DB_PASSWORD,
  ssl: configValues.DB_SSL,
  max: configValues.DB_POOL_MAX,
  idleTimeoutMillis: configValues.DB_POOL_IDLE_TIMEOUT_MS,
  statementTimeoutMs: configValues.DB_STATEMENT_TIMEOUT_MS,
};

export const commandCenterConfig = {
  topic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId:
    process.env.COMMAND_CENTER_CONSUMER_GROUP ?? `${serviceConfig.serviceId}-command-consumer`,
  targetServiceId: process.env.COMMAND_CENTER_TARGET_SERVICE_ID ?? serviceConfig.serviceId,
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
  maxRetries: parseNumberEnv(process.env.KAFKA_MAX_RETRIES, 3),
  retryBackoffMs: parseNumberEnv(process.env.KAFKA_RETRY_BACKOFF_MS, 1000),
  retryScheduleMs: parseNumberList(process.env.KAFKA_RETRY_SCHEDULE_MS),
};

export const availabilityGuardConfig = {
  address: process.env.AVAILABILITY_GUARD_ADDRESS ?? "localhost:4400",
  timeoutMs: parseNumberEnv(process.env.AVAILABILITY_GUARD_TIMEOUT_MS, 1500),
  enabled: parseBooleanEnv(process.env.AVAILABILITY_GUARD_ENABLED, true),
  shadowMode: parseBooleanEnv(process.env.AVAILABILITY_GUARD_SHADOW_MODE, true),
  failOpen: parseBooleanEnv(process.env.AVAILABILITY_GUARD_FAIL_OPEN, true),
  grpcAuthToken: process.env.AVAILABILITY_GUARD_GRPC_TOKEN ?? "",
};
