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
  resolveKafkaConfig,
  validateProductionSecrets,
} from "@tartware/config";

initServiceIdentity("@tartware/rooms-service");
ensureAuthDefaults();

const configValues = loadServiceConfig(databaseSchema);
validateProductionSecrets({
  ...configValues,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  AUTH_DEFAULT_PASSWORD: process.env.AUTH_DEFAULT_PASSWORD,
});

const kafka = resolveKafkaConfig({
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-rooms-service",
  defaultPrimaryBroker: "localhost:29092",
});

export const config = {
  service: buildServiceInfo(configValues),
  port: configValues.PORT,
  host: configValues.HOST,
  log: buildLogConfig(configValues),
  recommendation: {
    defaultResultSize: Number(process.env.RECOMMENDATION_DEFAULT_RESULT_SIZE ?? "10"),
    maxResultSize: Number(process.env.RECOMMENDATION_MAX_RESULT_SIZE ?? "50"),
    enableMlScoring: process.env.RECOMMENDATION_ENABLE_ML_SCORING !== "false",
    phoenixServiceUrl: process.env.PHOENIX_SERVICE_URL ?? "http://localhost:5000",
  },
  db: buildDbConfig(configValues),
  auth: buildAuthConfig(),
  kafka,
  commandCenter: buildCommandCenterConfig("rooms-service"),
};
