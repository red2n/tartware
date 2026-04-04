import { createKafkaProducer } from "@tartware/command-consumer-utils/producer";

import { config } from "../config.js";

import { kafka } from "./settings-kafka-client.js";

const producer = createKafkaProducer(kafka, {
  commandTopic: config.settings.commandCenter.topic,
  dlqTopic: config.settings.commandCenter.dlqTopic,
});

export const { publishDlqEvent, shutdown: shutdownSettingsProducer } = producer;
