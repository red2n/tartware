import { createKafkaClient } from "@tartware/command-consumer-utils/producer";

import { config } from "../config.js";

import { appLogger } from "./logger.js";

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export const kafka = createKafkaClient({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
  logger: appLogger,
});
