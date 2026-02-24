import {
  createKafkaProducer,
  type KafkaEventMessage,
} from "@tartware/command-consumer-utils/producer";

import { commandCenterConfig, kafkaConfig } from "../config.js";
import { kafka } from "./client.js";

const producer = createKafkaProducer(kafka, {
  commandTopic: kafkaConfig.topic,
  dlqTopic: kafkaConfig.dlqTopic,
});

export const { publishEvent, publishDlqEvent, shutdown: shutdownProducer } = producer;

/** Publishes a payload to the command-center dead-letter topic. */
export const publishCommandDlqEvent = (message: Omit<KafkaEventMessage, "topic">) =>
  producer.publishEvent({ ...message, topic: commandCenterConfig.dlqTopic });
