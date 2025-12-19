import { databaseSchema, loadServiceConfig } from "@tartware/config";

process.env.SERVICE_NAME =
  process.env.SERVICE_NAME ?? "@tartware/rooms-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";
process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "local-dev-secret";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "tartware-core";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware";

const configValues = loadServiceConfig(databaseSchema);

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
};
