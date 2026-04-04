import {
  databaseSchema,
  loadServiceConfig,
  parseBooleanEnv,
  parseNumberEnv,
  resolveKafkaConfig,
  validateProductionSecrets,
} from "@tartware/config";
import { config as loadEnv } from "dotenv";

loadEnv();

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/api-gateway";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

if (!process.env.AUTH_JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET must be set in production and cannot use a default value.");
  }
  process.env.AUTH_JWT_SECRET = "dev-secret-minimum-32-chars-change-me!";
}
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "tartware-core-service";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware-core";

const env = process.env;

const toRetryCount = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  if (parsed < 0) {
    return -1;
  }
  return Math.floor(parsed);
};

const toDelay = (value: string | undefined, fallback: number): number => {
  const parsed = parseNumberEnv(value, fallback);
  return Math.max(250, parsed);
};

const baseConfig = loadServiceConfig(databaseSchema);
validateProductionSecrets({
  ...baseConfig,
  NODE_ENV: env.NODE_ENV,
  AUTH_JWT_SECRET: env.AUTH_JWT_SECRET,
  AUTH_DEFAULT_PASSWORD: env.AUTH_DEFAULT_PASSWORD,
});
const runtimeEnvironment = (env.NODE_ENV ?? "development").toLowerCase();
const isProduction = runtimeEnvironment === "production";

export const gatewayConfig = {
  port: parseNumberEnv(env.API_GATEWAY_PORT, baseConfig.PORT ?? 8080),
  host: env.API_GATEWAY_HOST ?? baseConfig.HOST ?? "0.0.0.0",
  serviceId: env.API_GATEWAY_ID ?? baseConfig.SERVICE_NAME ?? "api-gateway",
  version: env.API_GATEWAY_VERSION ?? baseConfig.SERVICE_VERSION ?? "1.0.0",
  rateLimit: {
    /** Global default — applies to most read endpoints. */
    max: Number(env.API_GATEWAY_RATE_MAX ?? 200),
    timeWindow: env.API_GATEWAY_RATE_WINDOW ?? "1 minute",
    /** Tighter limit for command (write) endpoints. */
    commandMax: Number(env.API_GATEWAY_RATE_COMMAND_MAX ?? 60),
    commandTimeWindow: env.API_GATEWAY_RATE_COMMAND_WINDOW ?? "1 minute",
    /** Auth endpoints — stricter to mitigate brute-force. */
    authMax: Number(env.API_GATEWAY_RATE_AUTH_MAX ?? 20),
    authTimeWindow: env.API_GATEWAY_RATE_AUTH_WINDOW ?? "1 minute",
  },
  redis: {
    host: env.REDIS_HOST ?? "127.0.0.1",
    port: parseNumberEnv(env.REDIS_PORT, 6379),
    password: env.REDIS_PASSWORD,
    db: parseNumberEnv(env.REDIS_DB, 0),
    keyPrefix: env.REDIS_KEY_PREFIX ?? "tartware:gateway:",
    enabled: parseBooleanEnv(env.REDIS_ENABLED, true),
  },
  logRequests: parseBooleanEnv(env.API_GATEWAY_LOG_REQUESTS, false),
};
export const devToolsConfig = {
  duploDashboard: {
    enabled: parseBooleanEnv(env.API_GATEWAY_ENABLE_DUPLO_DASHBOARD, !isProduction),
    sharedSecret:
      env.API_GATEWAY_DUPLO_TOKEN && env.API_GATEWAY_DUPLO_TOKEN.length > 0
        ? env.API_GATEWAY_DUPLO_TOKEN
        : undefined,
  },
};

export const serviceTargets = {
  coreServiceUrl: env.CORE_SERVICE_URL ?? "http://localhost:3000",
  // settingsServiceUrl removed — routes absorbed into core-service (Phase 5)
  guestsServiceUrl: env.GUESTS_SERVICE_URL ?? "http://localhost:3010",
  roomsServiceUrl: env.ROOMS_SERVICE_URL ?? "http://localhost:3015",
  reservationCommandServiceUrl: env.RESERVATION_COMMAND_SERVICE_URL ?? "http://localhost:3020",
  billingServiceUrl: env.BILLING_SERVICE_URL ?? "http://localhost:3025",
  housekeepingServiceUrl: env.HOUSEKEEPING_SERVICE_URL ?? "http://localhost:3030",
  notificationServiceUrl: env.NOTIFICATION_SERVICE_URL ?? "http://localhost:3055",
  revenueServiceUrl: env.REVENUE_SERVICE_URL ?? "http://localhost:3060",
  // calculationServiceUrl removed — calculation absorbed into billing-service (Phase 6)
  // serviceRegistryUrl removed — registry absorbed into core-service (Phase 5)
  // accountsServiceUrl removed — accounts absorbed into billing-service (Phase 6)
  // financeAdminServiceUrl removed — finance-admin absorbed into billing-service (Phase 6)
};

export const dbConfig = {
  host: baseConfig.DB_HOST,
  port: baseConfig.DB_PORT,
  database: baseConfig.DB_NAME,
  user: baseConfig.DB_USER,
  password: baseConfig.DB_PASSWORD,
  ssl: baseConfig.DB_SSL,
  max: baseConfig.DB_POOL_MAX,
  idleTimeoutMillis: baseConfig.DB_POOL_IDLE_TIMEOUT_MS,
  statementTimeoutMs: baseConfig.DB_STATEMENT_TIMEOUT_MS,
};

export const authConfig = {
  jwt: {
    secret: process.env.AUTH_JWT_SECRET ?? "dev-secret-minimum-32-chars-change-me!",
    issuer: process.env.AUTH_JWT_ISSUER ?? "tartware-core-service",
    audience: process.env.AUTH_JWT_AUDIENCE ?? "tartware-core",
  },
};

export const kafkaConfig = {
  ...resolveKafkaConfig({
    clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-api-gateway",
    defaultPrimaryBroker: "localhost:29092",
  }),
  commandTopic: process.env.COMMAND_CENTER_TOPIC ?? "commands.primary",
};

export const commandRegistryConfig = {
  refreshIntervalMs: parseNumberEnv(env.COMMAND_REGISTRY_REFRESH_MS, 30000),
  startupMaxRetries: toRetryCount(env.COMMAND_REGISTRY_STARTUP_RETRIES, 12),
  startupRetryDelayMs: toDelay(env.COMMAND_REGISTRY_STARTUP_RETRY_DELAY_MS, 5000),
};
