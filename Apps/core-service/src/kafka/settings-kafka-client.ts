import { createKafkaClient } from "@tartware/command-consumer-utils/producer";

import { config } from "../config.js";

export const kafka = createKafkaClient({
  clientId: config.settings.kafka.clientId,
  brokers: config.settings.kafka.brokers,
});
