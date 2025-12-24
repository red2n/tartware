import { ensureDependencies, parseHostPort } from "@tartware/config";

import { shutdownAvailabilityGuardClient } from "./clients/availability-guard-client.js";
import {
  shutdownCommandCenterConsumer,
  startCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { databaseConfig, kafkaConfig, serviceConfig } from "./config.js";
import {
  shutdownReservationConsumer,
  startReservationConsumer,
} from "./kafka/consumer.js";
import { shutdownProducer } from "./kafka/producer.js";
import {
  shutdownOutboxDispatcher,
  startOutboxDispatcher,
} from "./outbox/dispatcher.js";
import { buildServer } from "./server.js";

const app = buildServer();
const kafkaEnabled = process.env.DISABLE_KAFKA !== "true";

const proc = globalThis.process;
let isShuttingDown = false;

const start = async () => {
  try {
    const kafkaBroker = kafkaConfig.brokers[0];
    const dependenciesOk = await ensureDependencies(
      [
        {
          name: "PostgreSQL",
          host: databaseConfig.host,
          port: databaseConfig.port,
        },
        ...(kafkaEnabled && kafkaBroker
          ? [{ name: "Kafka broker", ...parseHostPort(kafkaBroker, 9092) }]
          : []),
      ],
      { logger: app.log },
    );
    if (!dependenciesOk) {
      app.log.warn("Dependencies missing; exiting without starting service");
      if (proc) {
        proc.exit(0);
      } else {
        return;
      }
    }

    if (kafkaEnabled) {
      await startReservationConsumer();
      await startCommandCenterConsumer();
      startOutboxDispatcher();
    } else {
      app.log.warn(
        "Kafka disabled via DISABLE_KAFKA; skipping consumers and outbox",
      );
    }
    await app.listen({ port: serviceConfig.port, host: serviceConfig.host });
    app.log.info(
      {
        service: serviceConfig.serviceId,
        port: serviceConfig.port,
        host: serviceConfig.host,
      },
      "reservations command service listening",
    );
  } catch (error) {
    app.log.error(error, "failed to start reservations command service");
    await shutdown();
    proc?.exit(1);
  }
};

const shutdown = async () => {
  if (isShuttingDown) {
    app.log.info("Shutdown already in progress");
    return;
  }
  isShuttingDown = true;
  try {
    if (kafkaEnabled) {
      await shutdownReservationConsumer();
      await shutdownCommandCenterConsumer();
      await shutdownOutboxDispatcher();
      await shutdownProducer();
    }
    await shutdownAvailabilityGuardClient();
    await app.close();
  } catch (error) {
    app.log.error(error, "error during graceful shutdown");
  }
};

if (proc && "on" in proc && typeof proc.on === "function") {
  proc.on("SIGTERM", () => {
    app.log.info("SIGTERM received, shutting down");
    shutdown().finally(() => proc.exit(0));
  });
  proc.on("SIGINT", () => {
    app.log.info("SIGINT received, shutting down");
    shutdown().finally(() => proc.exit(0));
  });
}

start().catch((error) => {
  app.log.error(error, "Unhandled error on startup");
});
