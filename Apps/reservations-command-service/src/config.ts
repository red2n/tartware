import {
  buildDbConfig,
  databaseSchema,
  initServiceIdentity,
  loadServiceConfig,
  parseBooleanEnv,
  parseNumberEnv,
  parseNumberList,
  resolveKafkaConfig,
} from "@tartware/config";

initServiceIdentity("@tartware/reservations-command-service");

const configValues = loadServiceConfig(databaseSchema);

const kafka = resolveKafkaConfig({
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-reservations-command",
  defaultPrimaryBroker: "localhost:29092",
});

const defaultRetryScheduleMs = parseNumberList(process.env.KAFKA_RETRY_SCHEDULE_MS);

export const serviceConfig = {
  port: configValues.PORT,
  host: configValues.HOST,
  serviceId: process.env.RESERVATION_COMMAND_ID ?? "@tartware/reservations-command-service",
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
  // Delay after an *empty* cycle only; a full batch reschedules immediately, so
  // a backlog drains at the speed of the database and broker, not the poll rate.
  // The old 2s fixed poll paired with a 25-row batch capped this dispatcher at
  // ~12 rows/sec and it fell hours behind under load.
  idlePollIntervalMs: Math.max(10, parseNumberEnv(process.env.OUTBOX_IDLE_POLL_MS, 50)),
  batchSize: parseNumberEnv(process.env.OUTBOX_BATCH_SIZE, 500),
  lockTimeoutMs: parseNumberEnv(process.env.OUTBOX_LOCK_TIMEOUT_MS, 30000),
  lockSweepEveryCycles: Math.max(1, parseNumberEnv(process.env.OUTBOX_LOCK_SWEEP_CYCLES, 200)),
  maxRetries: parseNumberEnv(process.env.OUTBOX_MAX_RETRIES, 5),
  retryBackoffMs: parseNumberEnv(process.env.OUTBOX_RETRY_BACKOFF_MS, 5000),
  // The per-tenant publish throttle was removed with the serial loop it paced.
  // It defaulted to 0 ms (disabled), so nothing was relying on it; batching
  // makes per-record spacing meaningless anyway. Fairness between tenants now
  // belongs at the partition level, not the publish loop.
};

export const reliabilityConfig = {
  stalledThresholdSeconds: parseNumberEnv(process.env.RELIABILITY_STALLED_THRESHOLD_SECONDS, 120),
  consumerStaleSeconds: parseNumberEnv(process.env.RELIABILITY_CONSUMER_STALE_SECONDS, 60),
  outboxWarnThreshold: parseNumberEnv(process.env.RELIABILITY_OUTBOX_WARN_THRESHOLD, 100),
  outboxCriticalThreshold: parseNumberEnv(process.env.RELIABILITY_OUTBOX_CRITICAL_THRESHOLD, 500),
  dlqWarnThreshold: parseNumberEnv(process.env.RELIABILITY_DLQ_WARN_THRESHOLD, 10),
  dlqCriticalThreshold: parseNumberEnv(process.env.RELIABILITY_DLQ_CRITICAL_THRESHOLD, 50),
};

export const databaseConfig = buildDbConfig(configValues);

export const commandCenterConfig = {
  topic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId:
    process.env.COMMAND_CENTER_CONSUMER_GROUP ?? "reservations-command-center-consumer",
  targetServiceId: process.env.COMMAND_CENTER_TARGET_SERVICE_ID ?? "reservations-command-service",
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
  dlqTopic: process.env.COMMAND_CENTER_DLQ_TOPIC ?? "commands.primary.dlq",
  maxRetries: parseNumberEnv(process.env.KAFKA_MAX_RETRIES, 3),
  retryBackoffMs: parseNumberEnv(process.env.KAFKA_RETRY_BACKOFF_MS, 1000),
  retryScheduleMs: parseNumberList(process.env.KAFKA_RETRY_SCHEDULE_MS),
  // This is the one service that assembles this config by hand instead of
  // calling `buildCommandCenterConfig`, so every field the shared builder gains
  // has to be mirrored here or this consumer silently diverges from the fleet.
  partitionsConsumedConcurrently: parseNumberEnv(
    process.env.RESERVATIONS_COMMAND_SERVICE_KAFKA_PARTITION_CONCURRENCY ??
      process.env.KAFKA_PARTITION_CONCURRENCY,
    4,
  ),
};

export const availabilityGuardConfig = {
  address: process.env.AVAILABILITY_GUARD_ADDRESS ?? "localhost:4400",
  timeoutMs: parseNumberEnv(process.env.AVAILABILITY_GUARD_TIMEOUT_MS, 5000),
  enabled: parseBooleanEnv(process.env.AVAILABILITY_GUARD_ENABLED, true),
  shadowMode: parseBooleanEnv(process.env.AVAILABILITY_GUARD_SHADOW_MODE, true),
  failOpen: parseBooleanEnv(process.env.AVAILABILITY_GUARD_FAIL_OPEN, true),
  grpcAuthToken: process.env.AVAILABILITY_GUARD_GRPC_TOKEN ?? "",
};
