import {
  buildAuthConfig,
  buildCommandCenterConfig,
  buildDbConfig,
  buildLogConfig,
  buildServiceInfo,
  databaseSchema,
  ensureAuthDefaults,
  initServiceIdentity,
  loadServiceConfig,
  parseBooleanEnv,
  parseNumberEnv,
  resolveKafkaConfig,
  validateProductionSecrets,
} from "@tartware/config";

initServiceIdentity("@tartware/guests-service");
ensureAuthDefaults();

const configValues = loadServiceConfig(databaseSchema);
validateProductionSecrets({
  ...configValues,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  AUTH_DEFAULT_PASSWORD: process.env.AUTH_DEFAULT_PASSWORD,
});

const kafka = resolveKafkaConfig({
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-guests-service",
  defaultPrimaryBroker: "localhost:29092",
});

const guestExperienceCommandCenter = {
  consumerGroupId:
    process.env.GUEST_EXPERIENCE_COMMAND_CENTER_CONSUMER_GROUP ??
    "guest-experience-command-center-consumer",
  targetServiceId: process.env.GUEST_EXPERIENCE_TARGET_SERVICE_ID ?? "guest-experience-service",
};

const stripe = {
  secretKey: process.env.STRIPE_SECRET_KEY ?? "",
  enabled: process.env.STRIPE_ENABLED === "true" || !!process.env.STRIPE_SECRET_KEY,
};

const internalServices = {
  coreServiceUrl: process.env.CORE_SERVICE_URL ?? "http://localhost:3000",
  guestsServiceUrl: process.env.GUESTS_SERVICE_URL ?? "http://localhost:3010",
  roomsServiceUrl: process.env.ROOMS_SERVICE_URL ?? "http://localhost:3015",
};

const serviceAuth = {
  username: process.env.SERVICE_AUTH_USERNAME ?? "setup.admin",
  password: process.env.SERVICE_AUTH_PASSWORD ?? "TempPass123",
};

export const config = {
  service: buildServiceInfo(configValues),
  port: configValues.PORT,
  host: configValues.HOST,
  log: buildLogConfig(configValues),
  db: buildDbConfig(configValues),
  auth: buildAuthConfig(),
  compliance: {
    retention: {
      guestDataDays: parseNumberEnv(process.env.COMPLIANCE_GUEST_DATA_RETENTION_DAYS, 1095),
    },
    encryption: {
      requireGuestEncryption: parseBooleanEnv(
        process.env.COMPLIANCE_REQUIRE_GUEST_ENCRYPTION,
        true,
      ),
      guestDataKey: process.env.GUEST_DATA_ENCRYPTION_KEY ?? "local-dev-guest-key",
    },
  },
  kafka,
  commandCenter: buildCommandCenterConfig("guests-service"),
  guestExperienceCommandCenter,
  stripe,
  internalServices,
  serviceAuth,
};
