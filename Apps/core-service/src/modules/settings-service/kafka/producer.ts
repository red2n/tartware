import { createKafkaProducer } from "@tartware/command-consumer-utils/producer";

import { config } from "../config.js";
import { kafka } from "./client.js";

const producer = createKafkaProducer(kafka, {
  commandTopic: config.commandCenter.topic,
  dlqTopic: config.commandCenter.dlqTopic,
});

export const { publishDlqEvent, shutdown: shutdownProducer } = producer;
