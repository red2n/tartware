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
  ],
  consumerShutdowns: [
    shutdownBillingCommandCenterConsumer,
    shutdownAccountsCommandCenterConsumer,
    shutdownFinanceAdminCommandCenterConsumer,
  ],
  shutdownProducer,
});
