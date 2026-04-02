import process from "node:process";

import { ensureDependencies, parseHostPort, resolveOtelDependency } from "@tartware/config";
import { initTelemetry } from "@tartware/telemetry";

import {
  shutdownFinanceAdminCommandCenterConsumer,
  startFinanceAdminCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import { shutdownProducer } from "./kafka/producer.js";
import {
  shutdownAccountsCommandCenterConsumer,
  startAccountsCommandCenterConsumer,
} from "./modules/accounts-service/commands/command-center-consumer.js";
import { config as accountsConfig } from "./modules/accounts-service/config.js";
import { shutdownProducer as shutdownAccountsProducer } from "./modules/accounts-service/kafka/producer.js";
import {
  shutdownRevenueCommandCenterConsumer,
  startRevenueCommandCenterConsumer,
} from "./modules/revenue-service/commands/command-center-consumer.js";
import { config as revenueConfig } from "./modules/revenue-service/config.js";
import {
  shutdownReservationEventConsumer,
  startReservationEventConsumer,
} from "./modules/revenue-service/consumers/reservation-event-consumer.js";
import { shutdownProducer as shutdownRevenueProducer } from "./modules/revenue-service/kafka/producer.js";
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
    const accountsKafkaBroker = accountsConfig.kafka.brokers[0];
    const revenueKafkaBroker = revenueConfig.kafka.brokers[0];
    const telemetryDependency = resolveOtelDependency(true);
    const dependenciesOk = await ensureDependencies(
      [
        { name: "PostgreSQL", host: config.db.host, port: config.db.port },
        ...(kafkaEnabled && kafkaBroker
          ? [{ name: "Kafka broker", ...parseHostPort(kafkaBroker, 9092) }]
          : []),
        ...(kafkaEnabled && accountsKafkaBroker
          ? [{ name: "Accounts Kafka broker", ...parseHostPort(accountsKafkaBroker, 9092) }]
          : []),
        ...(kafkaEnabled && revenueKafkaBroker
          ? [{ name: "Revenue Kafka broker", ...parseHostPort(revenueKafkaBroker, 9092) }]
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
      await startFinanceAdminCommandCenterConsumer();
      await startAccountsCommandCenterConsumer();
      await startRevenueCommandCenterConsumer();
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
      await shutdownRevenueCommandCenterConsumer();
      await shutdownRevenueProducer();
      await shutdownAccountsCommandCenterConsumer();
      await shutdownAccountsProducer();
      await shutdownFinanceAdminCommandCenterConsumer();
      await shutdownProducer();
    }
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError) => app.log.error(shutdownError, "failed to shutdown telemetry"));
    proc?.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutdown signal received");
  try {
    if (kafkaEnabled) {
      await shutdownReservationEventConsumer();
      await shutdownRevenueCommandCenterConsumer();
      await shutdownRevenueProducer();
      await shutdownAccountsCommandCenterConsumer();
      await shutdownAccountsProducer();
      await shutdownFinanceAdminCommandCenterConsumer();
      await shutdownProducer();
    }
    await app.close();
    await telemetry
      ?.shutdown()
      .catch((shutdownError) => app.log.error(shutdownError, "failed to shutdown telemetry"));
    proc?.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    proc?.exit(1);
  }
};

proc?.on("SIGTERM", shutdown);
proc?.on("SIGINT", shutdown);

start();
