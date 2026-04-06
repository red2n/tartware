import {
  buildCommandCenterConfig,
  buildDbConfig,
  buildLogConfig,
  buildServiceInfo,
  coreAuthSchema,
  databaseSchema,
  ensureAuthDefaults,
  initServiceIdentity,
  loadServiceConfig,
  parseBooleanEnv,
  parseNumberEnv,
  redisSchema,
  resolveKafkaConfig,
  validateProductionSecrets,
} from "@tartware/config";

initServiceIdentity("@tartware/core-service");
ensureAuthDefaults({ issuer: "tartware-core-service", audience: "tartware-core" });
process.env.AUTH_DEFAULT_PASSWORD = process.env.AUTH_DEFAULT_PASSWORD ?? "TempPass123";

const configValues = loadServiceConfig(databaseSchema.merge(redisSchema).merge(coreAuthSchema));
validateProductionSecrets(configValues);

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

const guestDataRetentionDays = parseNumberEnv(
  process.env.COMPLIANCE_GUEST_DATA_RETENTION_DAYS,
  1095,
);
const billingDataRetentionDays = parseNumberEnv(
  process.env.COMPLIANCE_BILLING_DATA_RETENTION_DAYS,
  2555,
);
const guestEncryptionKey = process.env.GUEST_DATA_ENCRYPTION_KEY ?? "local-dev-guest-key";
const billingEncryptionKey = process.env.BILLING_DATA_ENCRYPTION_KEY ?? "local-dev-billing-key";
const offHoursStartHour = parseNumberEnv(process.env.COMPLIANCE_OFF_HOURS_START_HOUR, 0);
const offHoursEndHour = parseNumberEnv(process.env.COMPLIANCE_OFF_HOURS_END_HOUR, 6);
const impersonationAlertThreshold = parseNumberEnv(
  process.env.COMPLIANCE_IMPERSONATION_ALERT_THRESHOLD,
  5,
);
const impersonationAlertWindowMinutes = parseNumberEnv(
  process.env.COMPLIANCE_IMPERSONATION_ALERT_WINDOW_MINUTES,
  60,
);
const membershipCacheHitDropThreshold = Number(
  process.env.COMPLIANCE_MEMBERSHIP_CACHE_HIT_DROP_THRESHOLD ?? "0.6",
);
const membershipCacheHitDropCooldownMinutes = parseNumberEnv(
  process.env.COMPLIANCE_MEMBERSHIP_CACHE_HIT_DROP_COOLDOWN_MINUTES,
  15,
);

// ─── Service Registry ──────────────────────────────────────────────────────
const registryHeartbeatTtlMs = Number(process.env.REGISTRY_HEARTBEAT_TTL_MS) || 120_000;
const registrySweepIntervalMs = Number(process.env.REGISTRY_SWEEP_INTERVAL_MS) || 30_000;

// ─── Settings Kafka consumer ───────────────────────────────────────────────
const settingsKafka = resolveKafkaConfig({
  clientId: process.env.SETTINGS_KAFKA_CLIENT_ID ?? "tartware-core-settings-consumer",
  defaultPrimaryBroker: "localhost:29092",
});

const settingsCommandCenter = buildCommandCenterConfig("settings-service");

export const config = {
  service: buildServiceInfo(configValues),
  port: configValues.PORT,
  host: configValues.HOST,
  log: buildLogConfig(configValues),
  db: buildDbConfig(configValues),
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
      requireGuestEncryption: parseBooleanEnv(
        process.env.COMPLIANCE_REQUIRE_GUEST_ENCRYPTION,
        true,
      ),
      requireBillingEncryption: parseBooleanEnv(
        process.env.COMPLIANCE_REQUIRE_BILLING_ENCRYPTION,
        true,
      ),
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
  registry: {
    heartbeatTtlMs: registryHeartbeatTtlMs,
    sweepIntervalMs: registrySweepIntervalMs,
  },
  settings: {
    dataSource: (process.env.SETTINGS_DATA_SOURCE ?? "seed").toLowerCase(),
    kafka: settingsKafka,
    commandCenter: settingsCommandCenter,
  },
};
