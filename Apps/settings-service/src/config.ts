import { databaseSchema, jwtVerificationSchema, loadServiceConfig } from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/settings-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

const configValues = loadServiceConfig(databaseSchema.merge(jwtVerificationSchema));

export const config = {
  service: {
    name: configValues.SERVICE_NAME,
    version: configValues.SERVICE_VERSION,
  },
  settings: {
    dataSource: (process.env.SETTINGS_DATA_SOURCE ?? "seed").toLowerCase(),
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
    audience: configValues.JWT_AUDIENCE,
    issuer: configValues.JWT_ISSUER,
    publicKey: configValues.JWT_PUBLIC_KEY,
  },
};
