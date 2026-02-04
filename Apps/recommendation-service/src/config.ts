/**
 * Configuration for the recommendation service.
 * Self-contained config without external @tartware/config dependency.
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().default("@tartware/recommendation-service"),
  SERVICE_VERSION: z.string().default("0.1.0"),
  PORT: z.coerce.number().default(3201),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  LOG_PRETTY: z.preprocess((v) => v === "true" || v === "1", z.boolean()).default(false),
  LOG_REQUESTS: z.preprocess((v) => v === "true" || v === "1", z.boolean()).default(true),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("tartware"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),
  DB_SSL: z.preprocess((v) => v === "true" || v === "1", z.boolean()).default(false),
  DB_POOL_MAX: z.coerce.number().default(20),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(30000),
  AUTH_JWT_SECRET: z.string().default("dev-secret-minimum-32-chars-change-me!"),
  AUTH_JWT_ISSUER: z.string().default("tartware-core-service"),
  AUTH_JWT_AUDIENCE: z.string().default("tartware-core"),
  RECOMMENDATION_DEFAULT_RESULT_SIZE: z.coerce.number().default(10),
  RECOMMENDATION_MAX_RESULT_SIZE: z.coerce.number().default(50),
  RECOMMENDATION_ENABLE_ML_SCORING: z.preprocess((v) => v !== "false", z.boolean()).default(true),
  PHOENIX_SERVICE_URL: z.string().default("http://localhost:5000"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Environment configuration error:", parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  service: {
    name: env.SERVICE_NAME,
    version: env.SERVICE_VERSION,
  },
  port: env.PORT,
  host: env.HOST,
  log: {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
    requestLogging: env.LOG_REQUESTS,
  },
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  },
  auth: {
    jwt: {
      secret: env.AUTH_JWT_SECRET,
      issuer: env.AUTH_JWT_ISSUER,
      audience: env.AUTH_JWT_AUDIENCE,
    },
  },
  recommendation: {
    defaultResultSize: env.RECOMMENDATION_DEFAULT_RESULT_SIZE,
    maxResultSize: env.RECOMMENDATION_MAX_RESULT_SIZE,
    enableMlScoring: env.RECOMMENDATION_ENABLE_ML_SCORING,
    phoenixServiceUrl: env.PHOENIX_SERVICE_URL,
  },
};
