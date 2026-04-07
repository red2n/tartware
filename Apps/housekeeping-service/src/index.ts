import { bootstrapService } from "@tartware/fastify-server";

import {
  shutdownHousekeepingCommandCenterConsumer,
  startHousekeepingCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";

const app = buildServer();

await bootstrapService({
  app,
  config,
  consumerStarters: [startHousekeepingCommandCenterConsumer],
  consumerShutdowns: [shutdownHousekeepingCommandCenterConsumer],
  shutdownProducer,
});
