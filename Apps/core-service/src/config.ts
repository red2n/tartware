import { coreAuthSchema, databaseSchema, loadServiceConfig, redisSchema } from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/core-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

const configValues = loadServiceConfig(databaseSchema.merge(redisSchema).merge(coreAuthSchema));

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
  redis: {
    host: configValues.REDIS_HOST,
    port: configValues.REDIS_PORT,
    password: configValues.REDIS_PASSWORD,
    db: configValues.REDIS_DB,
    keyPrefix: configValues.REDIS_KEY_PREFIX,
    enabled: configValues.REDIS_ENABLED,
    ttl: {
      default: configValues.REDIS_TTL_DEFAULT,
      user: configValues.REDIS_TTL_USER,
      tenant: configValues.REDIS_TTL_TENANT,
      bloom: configValues.REDIS_TTL_BLOOM,
    },
  },
  auth: {
    jwt: {
      secret: configValues.AUTH_JWT_SECRET,
      issuer: configValues.AUTH_JWT_ISSUER,
      audience: configValues.AUTH_JWT_AUDIENCE,
      expiresInSeconds: configValues.AUTH_JWT_EXPIRES_IN_SECONDS,
    },
    defaultPassword: configValues.AUTH_DEFAULT_PASSWORD,
  },
};
