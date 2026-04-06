import { bootstrapService } from "@tartware/fastify-server";

import {
  shutdownGuestExperienceCommandConsumer,
  shutdownGuestsCommandCenterConsumer,
  startGuestExperienceCommandConsumer,
  startGuestsCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";

const app = buildServer();

await bootstrapService({
  app,
  config,
  consumerStarters: [startGuestsCommandCenterConsumer, startGuestExperienceCommandConsumer],
  consumerShutdowns: [shutdownGuestsCommandCenterConsumer, shutdownGuestExperienceCommandConsumer],
  shutdownProducer,
});
