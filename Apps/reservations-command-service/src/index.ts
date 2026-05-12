import { bootstrapService } from "@tartware/fastify-server";

import { shutdownAvailabilityGuardClient } from "./clients/availability-guard-client.js";
import {
  shutdownCommandCenterConsumer,
  startCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { databaseConfig, kafkaConfig, serviceConfig } from "./config.js";
import { FLOW_MANIFEST } from "./flow-manifest.js";
import { shutdownAutoCheckoutSweep, startAutoCheckoutSweep } from "./jobs/auto-checkout.js";
import { shutdownWaitlistSweep, startWaitlistSweep } from "./jobs/waitlist-sweep.js";
import { shutdownReservationConsumer, startReservationConsumer } from "./kafka/consumer.js";
import { shutdownProducer } from "./kafka/producer.js";
import { shutdownOutboxDispatcher, startOutboxDispatcher } from "./outbox/dispatcher.js";
import { buildServer } from "./server.js";

const app = buildServer();

const config = {
  service: { name: serviceConfig.serviceId, version: "0.1.0" },
  port: serviceConfig.port,
  host: serviceConfig.host,
  db: { host: databaseConfig.host, port: databaseConfig.port },
  kafka: { brokers: kafkaConfig.brokers },
};

await bootstrapService({
  app,
  config,
  consumerStarters: [
    startReservationConsumer,
    startCommandCenterConsumer,
    async () => startOutboxDispatcher(),
    async () => startWaitlistSweep(),
    async () => startAutoCheckoutSweep(),
  ],
  consumerShutdowns: [
    shutdownReservationConsumer,
    shutdownCommandCenterConsumer,
    shutdownOutboxDispatcher,
    async () => shutdownWaitlistSweep(),
    async () => shutdownAutoCheckoutSweep(),
    shutdownAvailabilityGuardClient,
  ],
  shutdownProducer,
  flowManifests: { manifests: [FLOW_MANIFEST], mode: "throw" },
});
