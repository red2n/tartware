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

initServiceIdentity("@tartware/notification-service");
ensureAuthDefaults();

const configValues = loadServiceConfig(databaseSchema);
validateProductionSecrets({
  ...configValues,
  NODE_ENV: process.env.NODE_ENV,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  AUTH_DEFAULT_PASSWORD: process.env.AUTH_DEFAULT_PASSWORD,
});

const kafka = resolveKafkaConfig({
  clientId: process.env.KAFKA_CLIENT_ID ?? "tartware-notification-service",
  defaultPrimaryBroker: "localhost:29092",
});

const reservationEvents = {
  topic: process.env.RESERVATION_EVENTS_TOPIC ?? "reservations.events",
  consumerGroupId:
    process.env.RESERVATION_EVENTS_CONSUMER_GROUP ?? "notification-reservation-events-consumer",
};

const notificationEvents = {
  topic: process.env.NOTIFICATION_EVENTS_TOPIC ?? "notifications.events",
};

const resendSenderDomain = process.env.RESEND_SENDER_DOMAIN ?? "swaas.tech";
const resendSenderEmail = process.env.RESEND_SENDER_EMAIL ?? `noreply@${resendSenderDomain}`;

const providers = {
  defaultChannel: process.env.NOTIFICATION_DEFAULT_CHANNEL ?? "console",
  webhookUrl: process.env.NOTIFICATION_WEBHOOK_URL ?? "",
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendSenderDomain,
  resendSenderEmail,
  defaultSenderEmail: process.env.NOTIFICATION_DEFAULT_SENDER_EMAIL ?? "noreply@tartware.com",
  defaultSenderName: process.env.NOTIFICATION_DEFAULT_SENDER_NAME ?? "Tartware PMS",
};

export const config = {
  service: buildServiceInfo(configValues),
  port: configValues.PORT,
  host: configValues.HOST,
  log: buildLogConfig(configValues),
  db: buildDbConfig(configValues),
  auth: buildAuthConfig(),
  kafka,
  commandCenter: buildCommandCenterConfig("notification-service"),
  reservationEvents,
  notificationEvents,
  providers,
};
