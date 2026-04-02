import {
  databaseSchema,
  loadServiceConfig,
  parseBooleanEnv,
  parseNumberEnv,
  resolveKafkaConfig,
} from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/availability-guard-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

const parseList = (value: string | undefined): string[] =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) ?? [];

const configValues = loadServiceConfig(databaseSchema);

const kafka = {
  ...resolveKafkaConfig({
    clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-availability-guard",
    defaultPrimaryBroker: "localhost:29092",
  }),
  reservationEventsTopic: process.env.RESERVATION_EVENTS_TOPIC ?? "reservations.events",
  inventoryEventsTopic: process.env.INVENTORY_EVENTS_TOPIC ?? "inventory.events.shadow",
  inventoryDlqTopic: process.env.INVENTORY_EVENTS_DLQ_TOPIC ?? "inventory.events.dlq",
  commandTopic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId: process.env.AVAILABILITY_GUARD_CONSUMER_GROUP ?? "availability-guard-service",
  maxBatchBytes: parseNumberEnv(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
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
  port: parseNumberEnv(process.env.GRPC_PORT, 4400),
  authToken: process.env.GRPC_AUTH_TOKEN ?? "",
};

const consumerEmailChannel = {
  enabled: parseBooleanEnv(process.env.AVAILABILITY_GUARD_NOTIFICATION_EMAIL_ENABLED, true),
  webhookUrl: process.env.AVAILABILITY_GUARD_NOTIFICATION_EMAIL_WEBHOOK_URL ?? "",
  apiKey: process.env.AVAILABILITY_GUARD_NOTIFICATION_EMAIL_API_KEY,
  timeoutMs: parseNumberEnv(process.env.AVAILABILITY_GUARD_NOTIFICATION_EMAIL_TIMEOUT_MS, 7000),
};

const consumerSmsChannel = {
  enabled: parseBooleanEnv(process.env.AVAILABILITY_GUARD_NOTIFICATION_SMS_ENABLED, false),
  webhookUrl: process.env.AVAILABILITY_GUARD_NOTIFICATION_SMS_WEBHOOK_URL ?? "",
  apiKey: process.env.AVAILABILITY_GUARD_NOTIFICATION_SMS_API_KEY,
  timeoutMs: parseNumberEnv(process.env.AVAILABILITY_GUARD_NOTIFICATION_SMS_TIMEOUT_MS, 5000),
};

const consumerSlackChannel = {
  enabled: parseBooleanEnv(
    process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_ENABLED,
    Boolean(process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_WEBHOOK_URL),
  ),
  webhookUrl: process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_WEBHOOK_URL ?? "",
  apiKey: process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_API_KEY,
  timeoutMs: parseNumberEnv(process.env.AVAILABILITY_GUARD_NOTIFICATION_SLACK_TIMEOUT_MS, 5000),
};

const isProduction = (process.env.NODE_ENV ?? "development").toLowerCase() === "production";
const defaultNotificationDryRun = !isProduction;

const manualReleaseConfig = {
  enabled: parseBooleanEnv(process.env.AVAILABILITY_GUARD_MANUAL_RELEASE_ENABLED, true),
  tokens: parseList(process.env.AVAILABILITY_GUARD_ADMIN_TOKENS),
  notifications: {
    enabled: parseBooleanEnv(process.env.AVAILABILITY_GUARD_NOTIFICATIONS_ENABLED, true),
    topic: process.env.AVAILABILITY_GUARD_NOTIFICATION_TOPIC ?? "availability-guard.notifications",
    recipients: parseList(process.env.AVAILABILITY_GUARD_NOTIFICATION_RECIPIENTS),
    consumer: {
      enabled: parseBooleanEnv(process.env.AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_ENABLED, true),
      groupId:
        process.env.AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_GROUP ??
        "availability-guard-notification-worker",
      maxRetries: parseNumberEnv(
        process.env.AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_MAX_RETRIES,
        3,
      ),
      retryBackoffMs: parseNumberEnv(
        process.env.AVAILABILITY_GUARD_NOTIFICATION_CONSUMER_RETRY_BACKOFF_MS,
        2000,
      ),
      dryRun: parseBooleanEnv(
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
  shadowMode: parseBooleanEnv(process.env.SHADOW_MODE, true),
  failOpen: parseBooleanEnv(process.env.AVAILABILITY_GUARD_FAIL_OPEN, true),
  defaultTtlSeconds: parseNumberEnv(process.env.LOCK_DEFAULT_TTL_SECONDS, 2 * 60 * 60),
  maxTtlSeconds: parseNumberEnv(process.env.LOCK_MAX_TTL_SECONDS, 24 * 60 * 60),
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
  rateLimit: {
    max: parseNumberEnv(process.env.AVAILABILITY_GUARD_RATE_MAX, 120),
    timeWindow: process.env.AVAILABILITY_GUARD_RATE_WINDOW ?? "1 minute",
    writeMax: parseNumberEnv(process.env.AVAILABILITY_GUARD_RATE_WRITE_MAX, 60),
    writeTimeWindow: process.env.AVAILABILITY_GUARD_RATE_WRITE_WINDOW ?? "1 minute",
    adminMax: parseNumberEnv(process.env.AVAILABILITY_GUARD_RATE_ADMIN_MAX, 20),
    adminTimeWindow: process.env.AVAILABILITY_GUARD_RATE_ADMIN_WINDOW ?? "1 minute",
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
