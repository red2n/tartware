import { Kafka } from "kafkajs";

import { kafkaConfig } from "../config.js";

export const kafka = new Kafka({
  clientId: kafkaConfig.clientId,
  brokers: kafkaConfig.brokers,
});
