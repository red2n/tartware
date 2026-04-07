import { bootstrapService } from "@tartware/fastify-server";

import {
  shutdownRoomsCommandCenterConsumer,
  startRoomsCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";

const app = buildServer();

await bootstrapService({
  app,
  config,
  consumerStarters: [startRoomsCommandCenterConsumer],
  consumerShutdowns: [shutdownRoomsCommandCenterConsumer],
  shutdownProducer,
});
