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
  SYSTEM_ADMIN_JWT_SECRET: z.string().min(8).optional(),
  SYSTEM_ADMIN_JWT_ISSUER: z.string().optional(),
  SYSTEM_ADMIN_JWT_AUDIENCE: z.string().optional(),
  SYSTEM_ADMIN_JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().default(900),
  SYSTEM_IMPERSONATION_JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().default(300),
  SYSTEM_ADMIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  SYSTEM_ADMIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),
  SYSTEM_ADMIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(100),
  SYSTEM_ADMIN_RATE_LIMIT_BURST: z.coerce.number().int().min(1).default(200),
  TENANT_AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  TENANT_AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),
  TENANT_AUTH_THROTTLE_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(20),
  TENANT_AUTH_THROTTLE_WINDOW_SECONDS: z.coerce.number().int().min(5).default(60),
  TENANT_AUTH_PASSWORD_MAX_AGE_DAYS: z.coerce.number().int().min(1).default(180),
  TENANT_AUTH_MFA_ISSUER: z.string().default("Tartware"),
  TENANT_AUTH_MFA_ENFORCED: booleanString.default(false),
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

export type DependencyTarget = {
  name: string;
  host: string;
  port: number;
  optional?: boolean;
};

type LoggerLike = {
  info?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
};

const parsePort = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseHostPort = (
  value: string,
  defaultPort: number,
): { host: string; port: number } => {
  const safeValue = value.trim();
  try {
    const url = safeValue.includes("://")
      ? new URL(safeValue)
      : new URL(`tcp://${safeValue}`);
    return {
      host: url.hostname,
      port: parsePort(url.port, url.protocol === "https:" ? 443 : defaultPort),
    };
  } catch {
    let hostPart: string | undefined;
    let portPart: string | undefined;

    if (safeValue.includes(":")) {
      [hostPart, portPart] = safeValue.split(":");
    }

    const host = hostPart || safeValue;
    return { host, port: parsePort(portPart, defaultPort) };
  }
};

const probePort = async (
  target: DependencyTarget,
  timeoutMs: number,
): Promise<{ target: DependencyTarget; ok: boolean; reason?: string }> => {
  const { host, port } = target;

  const net = await import("node:net");

  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = (error: Error) => {
      socket.destroy();
      resolve({ target, ok: false, reason: error.message });
    };

    socket.setTimeout(timeoutMs, () => onError(new Error("timeout")));
    socket.once("error", onError);
    socket.connect(port, host, () => {
      socket.end();
      resolve({ target, ok: true });
    });
  });
};

export const ensureDependencies = async (
  dependencies: DependencyTarget[],
  options?: { timeoutMs?: number; logger?: LoggerLike },
): Promise<boolean> => {
  const timeoutMs = options?.timeoutMs ?? 1000;
  const logger = options?.logger ?? console;

  const skipDependencyCheck =
    process.env.TARTWARE_SKIP_DEPENDENCY_CHECK === "true" ||
    process.env.SKIP_DEPENDENCY_CHECK === "true";

  if (skipDependencyCheck) {
    logger.warn?.(
      { dependencyCount: dependencies.length },
      "Skipping dependency preflight because SKIP_DEPENDENCY_CHECK is set",
    );
    return true;
  }

  if (!dependencies.length) {
    return true;
  }

  const results = await Promise.all(
    dependencies.map((dep) => probePort(dep, timeoutMs)),
  );

  const failed = results.filter(
    (result) => !result.ok && !result.target.optional,
  );
  const optionalFailed = results.filter(
    (result) => !result.ok && result.target.optional,
  );

  if (failed.length > 0) {
    logger.warn?.(
      {
        failed: failed.map(({ target, reason }) => ({
          name: target.name,
          host: target.host,
          port: target.port,
          reason,
        })),
        hint: "Ensure required services are running or set SKIP_DEPENDENCY_CHECK=true to bypass (not recommended for production).",
      },
      "Mandatory dependencies are unavailable",
    );
    return false;
  }

  if (optionalFailed.length > 0) {
    logger.warn?.(
      {
        failed: optionalFailed.map(({ target, reason }) => ({
          name: target.name,
          host: target.host,
          port: target.port,
          reason,
        })),
      },
      "Optional dependencies are unavailable; continuing startup",
    );
  }

  return true;
};

export const resolveOtelDependency = (
  optional = true,
): DependencyTarget | null => {
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;

  if (!endpoint) {
    return null;
  }

  const { host, port } = parseHostPort(endpoint, 4318);
  return {
    name: "OpenTelemetry collector",
    host,
    port,
    optional,
  };
};

export {
  parseBooleanEnv,
  parseBrokerList,
  parseNumberEnv,
  parseNumberList,
  resolveKafkaConfig,
} from "./kafka.js";
