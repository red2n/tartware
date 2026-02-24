import { createKafkaProducer } from "@tartware/command-consumer-utils/producer";

import { config } from "../config.js";
import { kafka } from "./client.js";

const producer = createKafkaProducer(kafka, {
  commandTopic: config.kafka.topic,
  dlqTopic: config.kafka.dlqTopic,
});

export const publishCommandEvent = producer.publishEvent;
export const publishCommandDlqEvent = producer.publishDlqEvent;
export const { shutdown: shutdownProducer } = producer;
