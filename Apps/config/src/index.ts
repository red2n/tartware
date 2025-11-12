import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const booleanString = z
  .union([
    z.boolean(),
    z
      .string()
      .transform((value) => ["true", "1", "yes", "on"].includes(value.toLowerCase())),
  ])
  .default(false)
  .transform((value) => value === true);

export const baseConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().default("service"),
  SERVICE_VERSION: z.string().default("0.0.0"),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),
  LOG_PRETTY: booleanString,
  LOG_REQUESTS: booleanString.default(true),
});

export const databaseSchema = z.object({
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_NAME: z.string().default("tartware"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),
  DB_SSL: booleanString,
  DB_POOL_MAX: z.coerce.number().int().default(10),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().default(30000),
});

export const redisSchema = z.object({
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().default(0),
  REDIS_KEY_PREFIX: z.string().default("tartware:"),
  REDIS_ENABLED: booleanString.default(true),
  REDIS_TTL_DEFAULT: z.coerce.number().int().default(3600),
  REDIS_TTL_USER: z.coerce.number().int().default(1800),
  REDIS_TTL_TENANT: z.coerce.number().int().default(3600),
  REDIS_TTL_BLOOM: z.coerce.number().int().default(86400),
});

export const jwtVerificationSchema = z.object({
  JWT_AUDIENCE: z.string(),
  JWT_ISSUER: z.string(),
  JWT_PUBLIC_KEY: z.string(),
});

export const coreAuthSchema = z.object({
  AUTH_JWT_SECRET: z.string().min(8),
  AUTH_JWT_ISSUER: z.string().default("tartware-core-service"),
  AUTH_JWT_AUDIENCE: z.string().optional(),
  AUTH_JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().default(900),
  AUTH_DEFAULT_PASSWORD: z.string().min(8).default("ChangeMe123!"),
});

export type BaseConfig = z.infer<typeof baseConfigSchema>;

export function loadServiceConfig(): z.infer<typeof baseConfigSchema>;
export function loadServiceConfig<TSchema extends z.ZodObject<any>>(
  schema: TSchema,
): z.infer<typeof baseConfigSchema> & z.infer<TSchema>;
export function loadServiceConfig<TSchema extends z.ZodObject<any>>(
  schema?: TSchema,
) {
  const mergedSchema = schema ? baseConfigSchema.merge(schema) : baseConfigSchema;
  const result = mergedSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    // eslint-disable-next-line no-console
    console.error("Invalid environment variables", formatted);
    throw new Error("Failed to load service configuration");
  }

  if (schema) {
    return result.data as z.infer<typeof baseConfigSchema> & z.infer<TSchema>;
  }

  return result.data as z.infer<typeof baseConfigSchema>;
}
