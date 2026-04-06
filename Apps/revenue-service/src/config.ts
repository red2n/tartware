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

initServiceIdentity("@tartware/revenue-service");
ensureAuthDefaults();

const configValues = loadServiceConfig(databaseSchema);
validateProductionSecrets({
  ...configValues,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_DEFAULT_PASSWORD: process.env.AUTH_DEFAULT_PASSWORD,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
});

const kafka = resolveKafkaConfig({
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-revenue-service",
  defaultPrimaryBroker: "localhost:29092",
});

export const config = {
  service: buildServiceInfo(configValues),
  port: configValues.PORT,
  host: configValues.HOST,
  log: buildLogConfig(configValues),
  db: buildDbConfig(configValues),
  auth: buildAuthConfig(),
  kafka,
  commandCenter: buildCommandCenterConfig("revenue-service"),
  reservationEvents: {
    topic: process.env.RESERVATION_EVENTS_TOPIC ?? "reservations.events",
    consumerGroupId:
      process.env.RESERVATION_EVENTS_CONSUMER_GROUP ?? "revenue-reservation-events-consumer",
  },
};
