import { config as loadEnv } from "dotenv";

loadEnv();

const env = process.env;

const parseNumberList = (value: string | undefined): number[] => {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
};

const parseBrokerList = (value: string | undefined, fallback?: string): string[] =>
  (value ?? fallback ?? "")
    .split(",")
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

export const serviceConfig = {
  port: Number(env.RESERVATION_COMMAND_PORT ?? 3101),
  host: env.RESERVATION_COMMAND_HOST ?? "0.0.0.0",
  serviceId: env.RESERVATION_COMMAND_ID ?? "reservations-command-service",
  requestLogging: parseBoolean(env.RESERVATION_COMMAND_LOG_REQUESTS, false),
};

const runtimeEnv = (env.NODE_ENV ?? "development").toLowerCase();
const isProduction = runtimeEnv === "production";

const defaultRetryScheduleMs = parseNumberList(env.KAFKA_RETRY_SCHEDULE_MS);
const primaryKafkaBrokers = parseBrokerList(env.KAFKA_BROKERS, "localhost:9092");
const usedDefaultPrimary = (env.KAFKA_BROKERS ?? "").trim().length === 0;
const failoverKafkaBrokers = parseBrokerList(env.KAFKA_FAILOVER_BROKERS);
const requestedKafkaCluster = (env.KAFKA_ACTIVE_CLUSTER ?? "primary").toLowerCase();
const kafkaFailoverEnabled = parseBoolean(env.KAFKA_FAILOVER_ENABLED, false);
const useFailover =
  (requestedKafkaCluster === "failover" || kafkaFailoverEnabled) && failoverKafkaBrokers.length > 0;
const resolvedKafkaBrokers =
  useFailover && failoverKafkaBrokers.length > 0
    ? failoverKafkaBrokers
    : primaryKafkaBrokers.length > 0
      ? primaryKafkaBrokers
      : failoverKafkaBrokers;
const kafkaActiveCluster =
  resolvedKafkaBrokers === failoverKafkaBrokers && resolvedKafkaBrokers.length > 0
    ? "failover"
    : "primary";

if (primaryKafkaBrokers.length === 0 && failoverKafkaBrokers.length === 0) {
  throw new Error("KAFKA_BROKERS or KAFKA_FAILOVER_BROKERS must be set");
}

if (useFailover && failoverKafkaBrokers.length === 0) {
  throw new Error("Failover requested/enabled but KAFKA_FAILOVER_BROKERS is empty");
}

if (kafkaActiveCluster === "primary" && primaryKafkaBrokers.length === 0) {
  throw new Error("Primary cluster requested but KAFKA_BROKERS is empty");
}

if (isProduction && usedDefaultPrimary && kafkaActiveCluster === "primary") {
  throw new Error(
    "Production requires explicit KAFKA_BROKERS; default localhost fallback is disabled",
  );
}

export const kafkaConfig = {
  clientId: env.KAFKA_CLIENT_ID ?? "tartware-reservations-command",
  brokers: resolvedKafkaBrokers,
  primaryBrokers: primaryKafkaBrokers,
  failoverBrokers: failoverKafkaBrokers,
  activeCluster: kafkaActiveCluster,
  topic: env.KAFKA_RESERVATION_TOPIC ?? "reservations.events",
  consumerGroupId: env.KAFKA_RESERVATION_CONSUMER_GROUP ?? "reservations-event-consumers",
  dlqTopic: env.RESERVATION_DLQ_TOPIC ?? "reservations.events.dlq",
  maxRetries: Number(env.KAFKA_MAX_RETRIES ?? 3),
  retryBackoffMs: Number(env.KAFKA_RETRY_BACKOFF_MS ?? 1000),
  maxBatchBytes: Number(env.KAFKA_MAX_BATCH_BYTES ?? 1048576),
  retryScheduleMs: defaultRetryScheduleMs.length > 0 ? defaultRetryScheduleMs : [1000, 5000, 30000],
};

export const outboxConfig = {
  workerId: env.OUTBOX_WORKER_ID ?? `${serviceConfig.serviceId}-outbox`,
  pollIntervalMs: Number(env.OUTBOX_POLL_INTERVAL_MS ?? 2000),
  batchSize: Number(env.OUTBOX_BATCH_SIZE ?? 25),
  lockTimeoutMs: Number(env.OUTBOX_LOCK_TIMEOUT_MS ?? 30000),
  maxRetries: Number(env.OUTBOX_MAX_RETRIES ?? 5),
  retryBackoffMs: Number(env.OUTBOX_RETRY_BACKOFF_MS ?? 5000),
  tenantThrottleMs: Number(env.OUTBOX_TENANT_THROTTLE_MS ?? 0),
  tenantJitterMs: Number(env.OUTBOX_TENANT_JITTER_MS ?? 0),
  tenantThrottleCleanupMs: Number(env.OUTBOX_TENANT_THROTTLE_CLEANUP_MS ?? 60_000),
};

export const reliabilityConfig = {
  stalledThresholdSeconds: Number(env.RELIABILITY_STALLED_THRESHOLD_SECONDS ?? 120),
  consumerStaleSeconds: Number(env.RELIABILITY_CONSUMER_STALE_SECONDS ?? 60),
  outboxWarnThreshold: Number(env.RELIABILITY_OUTBOX_WARN_THRESHOLD ?? 100),
  outboxCriticalThreshold: Number(env.RELIABILITY_OUTBOX_CRITICAL_THRESHOLD ?? 500),
  dlqWarnThreshold: Number(env.RELIABILITY_DLQ_WARN_THRESHOLD ?? 10),
  dlqCriticalThreshold: Number(env.RELIABILITY_DLQ_CRITICAL_THRESHOLD ?? 50),
};

export const databaseConfig = {
  host: env.DB_HOST ?? "127.0.0.1",
  port: Number(env.DB_PORT ?? 5432),
  database: env.DB_NAME ?? "tartware",
  user: env.DB_USER ?? "postgres",
  password: env.DB_PASSWORD ?? "postgres",
  ssl: (env.DB_SSL ?? "false").toLowerCase() === "true",
  max: Number(env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(env.DB_POOL_IDLE_TIMEOUT_MS ?? 30000),
};

export const commandCenterConfig = {
  topic: env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId:
    env.COMMAND_CENTER_CONSUMER_GROUP ?? `${serviceConfig.serviceId}-command-consumer`,
  targetServiceId: env.COMMAND_CENTER_TARGET_SERVICE_ID ?? serviceConfig.serviceId,
};

export const availabilityGuardConfig = {
  address: env.AVAILABILITY_GUARD_ADDRESS ?? "localhost:4400",
  timeoutMs: Number(env.AVAILABILITY_GUARD_TIMEOUT_MS ?? 1500),
  enabled: parseBoolean(env.AVAILABILITY_GUARD_ENABLED, true),
  shadowMode: parseBoolean(env.AVAILABILITY_GUARD_SHADOW_MODE, true),
  failOpen: parseBoolean(env.AVAILABILITY_GUARD_FAIL_OPEN, true),
};
