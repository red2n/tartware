import { bootstrapService } from "@tartware/fastify-server";
import {
  shutdownAccountsCommandCenterConsumer,
  startAccountsCommandCenterConsumer,
} from "./commands/accounts-command-center-consumer.js";
import {
  shutdownBillingCommandCenterConsumer,
  startBillingCommandCenterConsumer,
} from "./commands/command-center-consumer.js";
import {
  shutdownFinanceAdminCommandCenterConsumer,
  startFinanceAdminCommandCenterConsumer,
} from "./commands/finance-admin-command-center-consumer.js";
import { config } from "./config.js";
import { shutdownArEventConsumer, startArEventConsumer } from "./consumers/ar-event-consumer.js";
import { FLOW_MANIFEST } from "./flow-manifest.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";

const app = buildServer();

await bootstrapService({
  app,
  config,
  consumerStarters: [
    startBillingCommandCenterConsumer,
    startAccountsCommandCenterConsumer,
    startFinanceAdminCommandCenterConsumer,
    startArEventConsumer,
  ],
  consumerShutdowns: [
    shutdownBillingCommandCenterConsumer,
    shutdownAccountsCommandCenterConsumer,
    shutdownFinanceAdminCommandCenterConsumer,
    shutdownArEventConsumer,
  ],
  shutdownProducer,
  flowManifests: { manifests: [FLOW_MANIFEST], mode: "warn" },
});
