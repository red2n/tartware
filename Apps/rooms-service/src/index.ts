import { bootstrapService } from "@tartware/fastify-server";

import {
  shutdownRoomsCommandCenterConsumer,
  startRoomsCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import { FLOW_MANIFEST } from "./flow-manifest.js";
import {
  shutdownAvailabilityRebuild,
  startAvailabilityRebuild,
} from "./jobs/availability-rebuild.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";

const app = buildServer();

await bootstrapService({
  app,
  config,
  consumerStarters: [startRoomsCommandCenterConsumer, async () => startAvailabilityRebuild()],
  consumerShutdowns: [
    shutdownRoomsCommandCenterConsumer,
    async () => shutdownAvailabilityRebuild(),
  ],
  shutdownProducer,
  flowManifests: { manifests: [FLOW_MANIFEST], mode: "throw" },
});
