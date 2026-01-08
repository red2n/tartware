import { databaseSchema, loadServiceConfig } from "@tartware/config";

process.env.SERVICE_NAME =
  process.env.SERVICE_NAME ?? "@tartware/housekeeping-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";
process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "local-dev-secret";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "tartware-core";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware";

const toNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (
  value: string | undefined,
  fallback: boolean,
): boolean => {
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

const parseBrokerList = (
  value: string | undefined,
  fallback?: string,
): string[] =>
  (value ?? fallback ?? "")
    .split(",")
    .map((broker) => broker.trim())
    .filter((broker) => broker.length > 0);

const configValues = loadServiceConfig(databaseSchema);

const primaryKafkaBrokers = parseBrokerList(
  process.env.KAFKA_BROKERS,
  "localhost:29092",
);
const failoverKafkaBrokers = parseBrokerList(
  process.env.KAFKA_FAILOVER_BROKERS,
);
const requestedCluster = (
  process.env.KAFKA_ACTIVE_CLUSTER ?? "primary"
).toLowerCase();
const failoverToggle = parseBoolean(process.env.KAFKA_FAILOVER_ENABLED, false);
const useFailover =
  (requestedCluster === "failover" || failoverToggle) &&
  failoverKafkaBrokers.length > 0;

let kafkaActiveCluster: "primary" | "failover" = "primary";
let kafkaBrokers = primaryKafkaBrokers;

if (useFailover) {
  kafkaBrokers = failoverKafkaBrokers;
  kafkaActiveCluster = "failover";
} else if (
  primaryKafkaBrokers.length === 0 &&
  failoverKafkaBrokers.length > 0
) {
  kafkaBrokers = failoverKafkaBrokers;
  kafkaActiveCluster = "failover";
}

const kafka = {
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-housekeeping-service",
  brokers: kafkaBrokers,
  primaryBrokers: primaryKafkaBrokers,
  failoverBrokers: failoverKafkaBrokers,
  activeCluster: kafkaActiveCluster,
};

const commandCenter = {
  topic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
  consumerGroupId:
    process.env.COMMAND_CENTER_CONSUMER_GROUP ??
    "housekeeping-command-center-consumer",
  targetServiceId:
    process.env.COMMAND_CENTER_TARGET_SERVICE_ID ?? "housekeeping-service",
  maxBatchBytes: toNumber(process.env.KAFKA_MAX_BATCH_BYTES, 1048576),
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
  kafka,
  commandCenter,
};
