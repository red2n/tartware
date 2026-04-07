import { bootstrapService } from "@tartware/fastify-server";

import {
  shutdownNotificationCommandCenterConsumer,
  startNotificationCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import {
  shutdownReservationEventConsumer,
  startReservationEventConsumer,
} from "./consumers/reservation-event-consumer.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";

const app = buildServer();

await bootstrapService({
  app,
  config,
  consumerStarters: [startNotificationCommandCenterConsumer, startReservationEventConsumer],
  consumerShutdowns: [shutdownNotificationCommandCenterConsumer, shutdownReservationEventConsumer],
  shutdownProducer,
});
