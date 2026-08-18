import { bootstrapService } from "@tartware/fastify-server";

import {
  shutdownGuestsCommandCenterConsumer,
  startGuestsCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import { config } from "./config.js";
import { FLOW_MANIFEST } from "./flow-manifest.js";
import {
  shutdownLoyaltyExpirySweep,
  startLoyaltyExpirySweep,
} from "./jobs/loyalty-expiry-sweep.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";

const app = buildServer();

await bootstrapService({
  app,
  config,
  consumerStarters: [startGuestsCommandCenterConsumer, async () => startLoyaltyExpirySweep()],
  consumerShutdowns: [
    shutdownGuestsCommandCenterConsumer,
    async () => shutdownLoyaltyExpirySweep(),
  ],
  shutdownProducer,
  flowManifests: { manifests: [FLOW_MANIFEST], mode: "throw" },
});
