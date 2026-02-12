import { databaseSchema, loadServiceConfig } from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/availability-guard-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

const toNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
};

const parseList = (value: string | undefined): string[] =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) ?? [];

const parseBrokerList = (value: string | undefined, fallback?: string): string[] =>
  (value ?? fallback ?? "")
    .split(",")
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

const configValues = loadServiceConfig(databaseSchema);

const runtimeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
const isProduction = runtimeEnv === "production";

const primaryKafkaBrokers = parseBrokerList(process.env.KAFKA_BROKERS, "localhost:29092");
const usedDefaultPrimary = (process.env.KAFKA_BROKERS ?? "").trim().length === 0;
const failoverKafkaBrokers = parseBrokerList(process.env.KAFKA_FAILOVER_BROKERS);
const requestedKafkaCluster = (process.env.KAFKA_ACTIVE_CLUSTER ?? "primary").toLowerCase();
const kafkaFailoverEnabled = toBoolean(process.env.KAFKA_FAILOVER_ENABLED, false);
const shouldUseFailover =
  (requestedKafkaCluster === "failover" || kafkaFailoverEnabled) && failoverKafkaBrokers.length > 0;
const kafkaBrokers =
  shouldUseFailover && failoverKafkaBrokers.length > 0
    ? failoverKafkaBrokers
    : primaryKafkaBrokers.length > 0
      ? primaryKafkaBrokers
      : failoverKafkaBrokers;
const kafkaActiveCluster =
  kafkaBrokers === failoverKafkaBrokers && kafkaBrokers.length > 0 ? "failover" : "primary";

if (primaryKafkaBrokers.length === 0 && failoverKafkaBrokers.length === 0) {
  throw new Error("KAFKA_BROKERS or KAFKA_FAILOVER_BROKERS must be set");
}

if (shouldUseFailover && failoverKafkaBrokers.length === 0) {
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

const kafka = {
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-availability-guard",
  brokers: kafkaBrokers,
  primaryBrokers: primaryKafkaBrokers,
  failoverBrokers: failoverKafkaBrokers,
  activeCluster: kafkaActiveCluster,
  reservationEventsTopic: process.env.RESERVATION_EVENTS_TOPIC ?? "reservations.events",
  inventoryEventsTopic: process.env.INVENTORY_EVENTS_TOPIC ?? "inventory.events.shadow",
  inventoryDlqTopic: process.env.INVENTORY_EVENTS_DLQ_TOPIC ?? "inventory.events.dlq",
  commandTopic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId: process.env.AVAILABILITY_GUARD_CONSUMER_GROUP ?? "availability-guard-service",
  maxBatchBytes: toNumber(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
};

const commandCenter = {
  topic: kafka.commandTopic,
  consumerGroupId:
    process.env.AVAILABILITY_GUARD_COMMAND_CONSUMER_GROUP ?? `${kafka.consumerGroupId}-commands`,
  targetServiceId: process.env.COMMAND_CENTER_TARGET_SERVICE_ID ?? "availability-guard-service",
  maxBatchBytes: kafka.maxBatchBytes,
};

const grpc = {
  host: process.env.GRPC_HOST ?? "0.0.0.0",
  port: toNumber(process.env.GRPC_PORT, 4400),
  authToken: process.env.GRPC_AUTH_TOKEN ?? "",
};

const consumerEmailChannel = {
  enabled: toBoolean(process.env.AVAILABILITY_GUARD_NOTIFICATION_EMAIL_ENABLED, true),
  webhookUrl: process.env.AVAILABILITY_GUARD_NOTIFICATION_EMAIL_WEBHOOK_URL ?? "",
  apiKey: process.env.AVAILABILITY_GUARD_NOTIFICATION_EMAIL_API_KEY,
  timeoutMs: toNumber(process.env.AVAILABILITY_GUARD_NOTIFICATION_EMAIL_TIMEOUT_MS, 7000),
};

const consumerSmsChannel = {
  enabled: toBoolean(process.env.AVAILABILITY_GUARD_NOTIFICATION_SMS_ENABLED, false),
  webhookUrl: process.env.AVAILABILITY_GUARD_NOTIFICATION_SMS_WEBHOOK_URL ?? "",
  apiKey: process.env.AVAILABILITY_GUARD_NOTIFICATION_SMS_API_KEY,
  timeoutMs: toNumber(process.env.AVAILABILITY_GUARD_NOTIFICATION_SMS_TIMEOUT_MS, 5000),
};

const consumerSlackChannel = {
  enabled: toBoolean(
    process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_ENABLED,
    Boolean(process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_WEBHOOK_URL),
  ),
  webhookUrl: process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_WEBHOOK_URL ?? "",
  apiKey: process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_API_KEY,
  timeoutMs: toNumber(process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_TIMEOUT_MS, 5000),
};

const defaultNotificationDryRun = !isProduction;

const manualReleaseConfig = {
  enabled: toBoolean(process.env.AVAILABILITY_GUARD_MANUAL_RELEASE_ENABLED, true),
  tokens: parseList(process.env.AVAILABILITY_GUARD_ADMIN_TOKENS),
  notifications: {
    enabled: toBoolean(process.env.AVAILABILITY_GUARD_NOTIFICATIONS_ENABLED, true),
    topic: process.env.AVAILABILITY_GUARD_NOTIFICATION_TOPIC ?? "availability-guard.notifications",
    recipients: parseList(process.env.AVAILABILITY_GUARD_NOTIFICATION_RECIPIENTS),
    consumer: {
      enabled: toBoolean(process.env.AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_ENABLED, true),
      groupId:
        process.env.AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_GROUP ??
        "availability-guard-notification-worker",
      maxRetries: toNumber(process.env.AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_MAX_RETRIES, 3),
      retryBackoffMs: toNumber(
        process.env.AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_RETRY_BACKOFF_MS,
        2000,
      ),
      dryRun: toBoolean(
        process.env.AVAILABILITY_GUARD_NOTIFICATION_DRY_RUN,
        defaultNotificationDryRun,
      ),
      channels: {
        email: consumerEmailChannel,
        sms: consumerSmsChannel,
        slack: consumerSlackChannel,
      },
    },
  },
};

const guard = {
  shadowMode: toBoolean(process.env.SHADOW_MODE, true),
  failOpen: toBoolean(process.env.AVAILABILITY_GUARD_FAIL_OPEN, true),
  defaultTtlSeconds: toNumber(process.env.LOCK_DEFAULT_TTL_SECONDS, 2 * 60 * 60),
  maxTtlSeconds: toNumber(process.env.LOCK_MAX_TTL_SECONDS, 24 * 60 * 60),
  manualRelease: manualReleaseConfig,
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
  kafka,
  grpc,
  guard,
  commandCenter,
};
