import { coreAuthSchema, databaseSchema, loadServiceConfig, redisSchema } from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/core-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

// PR feedback: Enforce JWT secret in production, fail fast if not set
if (process.env.NODE_ENV === "production" && !process.env.AUTH_JWT_SECRET) {
  throw new Error("AUTH_JWT_SECRET must be set in production environment");
}
process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "local-dev-secret-minimum-32-chars!";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "tartware-core-service";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "tartware-core";
process.env.AUTH_DEFAULT_PASSWORD = process.env.AUTH_DEFAULT_PASSWORD ?? "DevPassword123!";

const toNumber = (value: string | undefined, fallback: number): number => {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const FALSEY_VALUES = new Set(["0", "false", "no", "off"]);
const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return !FALSEY_VALUES.has(value.toLowerCase());
};

const configValues = loadServiceConfig(databaseSchema.merge(redisSchema).merge(coreAuthSchema));

const tenantAuthMaxFailedAttempts = configValues.TENANT_AUTH_MAX_FAILED_ATTEMPTS;
const tenantAuthLockoutMinutes = configValues.TENANT_AUTH_LOCKOUT_MINUTES;
const tenantAuthThrottleMaxAttempts = configValues.TENANT_AUTH_THROTTLE_MAX_ATTEMPTS;
const tenantAuthThrottleWindowSeconds = configValues.TENANT_AUTH_THROTTLE_WINDOW_SECONDS;
const tenantAuthPasswordMaxAgeDays = configValues.TENANT_AUTH_PASSWORD_MAX_AGE_DAYS;
const tenantAuthMfaIssuer = configValues.TENANT_AUTH_MFA_ISSUER;
const tenantAuthMfaEnforced = configValues.TENANT_AUTH_MFA_ENFORCED;

const systemAdminJwtSecret =
  configValues.SYSTEM_ADMIN_JWT_SECRET && configValues.SYSTEM_ADMIN_JWT_SECRET.length > 0
    ? configValues.SYSTEM_ADMIN_JWT_SECRET
    : configValues.AUTH_JWT_SECRET;

const systemAdminJwtIssuer =
  configValues.SYSTEM_ADMIN_JWT_ISSUER && configValues.SYSTEM_ADMIN_JWT_ISSUER.length > 0
    ? configValues.SYSTEM_ADMIN_JWT_ISSUER
    : `${configValues.SERVICE_NAME}:system`;

const systemAdminJwtAudience =
  configValues.SYSTEM_ADMIN_JWT_AUDIENCE && configValues.SYSTEM_ADMIN_JWT_AUDIENCE.length > 0
    ? configValues.SYSTEM_ADMIN_JWT_AUDIENCE
    : (configValues.AUTH_JWT_AUDIENCE ?? "tartware-system");

const guestDataRetentionDays = toNumber(process.env.COMPLIANCE_GUEST_DATA_RETENTION_DAYS, 1095);
const billingDataRetentionDays = toNumber(process.env.COMPLIANCE_BILLING_DATA_RETENTION_DAYS, 2555);
const guestEncryptionKey = process.env.GUEST_DATA_ENCRYPTION_KEY ?? "local-dev-guest-key";
const billingEncryptionKey = process.env.BILLING_DATA_ENCRYPTION_KEY ?? "local-dev-billing-key";
const offHoursStartHour = toNumber(process.env.COMPLIANCE_OFF_HOURS_START_HOUR, 0);
const offHoursEndHour = toNumber(process.env.COMPLIANCE_OFF_HOURS_END_HOUR, 6);
const impersonationAlertThreshold = toNumber(
  process.env.COMPLIANCE_IMPERSONATION_ALERT_THRESHOLD,
  5,
);
const impersonationAlertWindowMinutes = toNumber(
  process.env.COMPLIANCE_IMPERSONATION_ALERT_WINDOW_MINUTES,
  60,
);
const membershipCacheHitDropThreshold = Number(
  process.env.COMPLIANCE_MEMBERSHIP_CACHE_HIT_DROP_THRESHOLD ?? "0.6",
);
const membershipCacheHitDropCooldownMinutes = toNumber(
  process.env.COMPLIANCE_MEMBERSHIP_CACHE_HIT_DROP_COOLDOWN_MINUTES,
  15,
);

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
  tenantAuth: {
    security: {
      maxFailedAttempts: tenantAuthMaxFailedAttempts,
      lockoutMinutes: tenantAuthLockoutMinutes,
      throttle: {
        maxAttempts: tenantAuthThrottleMaxAttempts,
        windowSeconds: tenantAuthThrottleWindowSeconds,
      },
      password: {
        maxAgeDays: tenantAuthPasswordMaxAgeDays,
      },
      mfa: {
        issuer: tenantAuthMfaIssuer,
        enforced: tenantAuthMfaEnforced,
      },
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
  systemAdmin: {
    jwt: {
      secret: systemAdminJwtSecret,
      issuer: systemAdminJwtIssuer,
      audience: systemAdminJwtAudience,
      expiresInSeconds: configValues.SYSTEM_ADMIN_JWT_EXPIRES_IN_SECONDS,
    },
    impersonationJwt: {
      secret: configValues.AUTH_JWT_SECRET,
      issuer: configValues.AUTH_JWT_ISSUER,
      audience: configValues.AUTH_JWT_AUDIENCE ?? "tartware-core",
      expiresInSeconds: configValues.SYSTEM_IMPERSONATION_JWT_EXPIRES_IN_SECONDS,
    },
    security: {
      maxFailedAttempts: configValues.SYSTEM_ADMIN_MAX_FAILED_ATTEMPTS,
      lockoutMinutes: configValues.SYSTEM_ADMIN_LOCKOUT_MINUTES,
    },
    rateLimit: {
      perMinute: configValues.SYSTEM_ADMIN_RATE_LIMIT_PER_MINUTE,
      burst: configValues.SYSTEM_ADMIN_RATE_LIMIT_BURST,
    },
  },
  compliance: {
    retention: {
      guestDataDays: guestDataRetentionDays,
      billingDataDays: billingDataRetentionDays,
    },
    encryption: {
      requireGuestEncryption: toBoolean(process.env.COMPLIANCE_REQUIRE_GUEST_ENCRYPTION, true),
      requireBillingEncryption: toBoolean(process.env.COMPLIANCE_REQUIRE_BILLING_ENCRYPTION, true),
      guestDataKey: guestEncryptionKey,
      billingDataKey: billingEncryptionKey,
    },
    monitoring: {
      offHoursStartHour,
      offHoursEndHour,
      impersonationAlertThreshold,
      impersonationAlertWindowMinutes,
      membershipCacheHitDropThreshold,
      membershipCacheHitDropCooldownMinutes,
    },
  },
};
