import { createKafkaProducer } from "@tartware/command-consumer-utils/producer";

import { config } from "../config.js";

import { kafka } from "./settings-kafka-client.js";

const producer = createKafkaProducer(kafka, {
  commandTopic: config.settings.events.topic,
  dlqTopic: config.settings.events.dlqTopic,
});

export const {
  publishEvent: publishSettingsEvent,
  publishDlqEvent,
  shutdown: shutdownSettingsProducer,
} = producer;
