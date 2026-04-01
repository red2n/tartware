import process from "node:process";

import { ensureDependencies, parseHostPort, resolveOtelDependency } from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";

import {
  shutdownGuestsCommandCenterConsumer,
  startGuestsCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import { shutdownProducer } from "./kafka/producer.js";
import {
  shutdownGuestExperienceCommandConsumer,
  startGuestExperienceCommandConsumer,
} from "./modules/guest-experience-service/commands/command-center-consumer.js";
import { config as guestExperienceConfig } from "./modules/guest-experience-service/config.js";
import { shutdownProducer as shutdownGuestExperienceProducer } from "./modules/guest-experience-service/kafka/producer.js";
import {
  shutdownNotificationCommandCenterConsumer,
  startNotificationCommandCenterConsumer,
} from "./modules/notification-service/commands/command-center-consumer.js";
import { config as notificationConfig } from "./modules/notification-service/config.js";
import {
  shutdownReservationEventConsumer,
  startReservationEventConsumer,
} from "./modules/notification-service/consumers/reservation-event-consumer.js";
import { shutdownProducer as shutdownNotificationProducer } from "./modules/notification-service/kafka/producer.js";
import { buildServer } from "./server.js";

const telemetry = await initTelemetry({
  serviceName: config.service.name,
  serviceVersion: config.service.version,
  environment: process.env.NODE_ENV ?? "development",
  instrumentationOptions: {
    "@opentelemetry/instrumentation-fastify": {
      enabled: true,
    },
    "@opentelemetry/instrumentation-http": {
      enabled: true,
    },
    "@opentelemetry/instrumentation-pg": {
      enabled: true,
    },
  },
});

const app = buildServer();
const proc = process;
const kafkaEnabled = process.env.DISABLE_KAFKA !== "true";

const start = async () => {
  try {
    const kafkaBroker = config.kafka.brokers[0];
    const guestExperienceKafkaBroker = guestExperienceConfig.kafka.brokers[0];
    const notificationKafkaBroker = notificationConfig.kafka.brokers[0];
    const telemetryDependency = resolveOtelDependency(true);
    const dependenciesOk = await ensureDependencies(
      [
        { name: "PostgreSQL", host: config.db.host, port: config.db.port },
        ...(kafkaEnabled && kafkaBroker
          ? [{ name: "Kafka broker", ...parseHostPort(kafkaBroker, 9092) }]
          : []),
        ...(kafkaEnabled && guestExperienceKafkaBroker
          ? [
              {
                name: "Guest experience Kafka broker",
                ...parseHostPort(guestExperienceKafkaBroker, 9092),
              },
            ]
          : []),
        ...(kafkaEnabled && notificationKafkaBroker
          ? [{ name: "Notification Kafka broker", ...parseHostPort(notificationKafkaBroker, 9092) }]
          : []),
        ...(telemetryDependency ? [telemetryDependency] : []),
      ],
      { logger: app.log },
    );
    if (!dependenciesOk) {
      app.log.warn("Dependencies missing; exiting without starting service");
      await telemetry
        ?.shutdown()
        .catch((shutdownError: unknown) =>
          app.log.error(shutdownError, "Failed to shutdown telemetry"),
        );
      if (proc) {
        proc.exit(0);
      } else {
        return;
      }
    }

    if (kafkaEnabled) {
      await startGuestsCommandCenterConsumer();
      await startGuestExperienceCommandConsumer();
      await startNotificationCommandCenterConsumer();
      await startReservationEventConsumer();
    } else {
      app.log.warn("Kafka disabled via DISABLE_KAFKA; skipping consumer start");
    }
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      {
        port: config.port,
        host: config.host,
        environment: process.env.NODE_ENV ?? "development",
      },
      `${config.service.name} started`,
    );
  } catch (error) {
    app.log.error(error, `Failed to start ${config.service.name}`);
    if (kafkaEnabled) {
      await shutdownReservationEventConsumer();
      await shutdownNotificationCommandCenterConsumer();
      await shutdownNotificationProducer();
      await shutdownGuestExperienceCommandConsumer();
      await shutdownGuestExperienceProducer();
      await shutdownGuestsCommandCenterConsumer();
      await shutdownProducer();
    }
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError: unknown) =>
        app.log.error(shutdownError, "failed to shutdown telemetry"),
      );
    proc?.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutdown signal received");
  try {
    if (kafkaEnabled) {
      await shutdownReservationEventConsumer();
      await shutdownNotificationCommandCenterConsumer();
      await shutdownNotificationProducer();
      await shutdownGuestExperienceCommandConsumer();
      await shutdownGuestExperienceProducer();
      await shutdownGuestsCommandCenterConsumer();
      await shutdownProducer();
    }
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError: unknown) =>
        app.log.error(shutdownError, "failed to shutdown telemetry"),
      );
    proc?.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    proc?.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await start();
