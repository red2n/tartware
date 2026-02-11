import { databaseSchema, loadServiceConfig, validateProductionSecrets } from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/recommendation-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";
process.env.PORT = process.env.PORT ?? "3040";

if (!process.env.AUTH_JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET must be set in production and cannot use a default value.");
  }
  process.env.AUTH_JWT_SECRET = "dev-secret-minimum-32-chars-change-me!";
}
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "tartware-core-service";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware-core";

const configValues = loadServiceConfig(databaseSchema);
validateProductionSecrets({
  ...configValues,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  AUTH_DEFAULT_PASSWORD: process.env.AUTH_DEFAULT_PASSWORD,
});

export const config = {
  nodeEnv: configValues.NODE_ENV,
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
      secret: process.env.AUTH_JWT_SECRET,
      issuer: process.env.AUTH_JWT_ISSUER!,
      audience: process.env.AUTH_JWT_AUDIENCE!,
    },
  },
  recommendation: {
    defaultResultSize: Number(process.env.RECOMMENDATION_DEFAULT_RESULT_SIZE ?? "10"),
    maxResultSize: Number(process.env.RECOMMENDATION_MAX_RESULT_SIZE ?? "50"),
    enableMlScoring: process.env.RECOMMENDATION_ENABLE_ML_SCORING !== "false",
    phoenixServiceUrl: process.env.PHOENIX_SERVICE_URL ?? "http://localhost:5000",
  },
};
