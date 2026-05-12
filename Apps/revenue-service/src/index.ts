import process from "node:process";
import { bootstrapService } from "@tartware/fastify-server";
import { createServiceLogger } from "@tartware/telemetry";

import {
  shutdownRevenueCommandCenterConsumer,
  startRevenueCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import {
  shutdownReservationEventConsumer,
  startReservationEventConsumer,
} from "./consumers/reservation-event-consumer.js";
import { FLOW_MANIFEST } from "./flow-manifest.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";

const logger = createServiceLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
});

const app = buildServer({ logger });

await bootstrapService({
  app,
  config,
  consumerStarters: [startRevenueCommandCenterConsumer, startReservationEventConsumer],
  consumerShutdowns: [shutdownRevenueCommandCenterConsumer, shutdownReservationEventConsumer],
  shutdownProducer,
  flowManifests: { manifests: [FLOW_MANIFEST], mode: "throw" },
});
