import type { Producer, RecordMetadata } from "kafkajs";

import { kafkaConfig } from "../config.js";

import { kafka } from "./client.js";

let producer: Producer | null = null;

const getProducer = async (): Promise<Producer> => {
  if (producer) {
    return producer;
  }
  producer = kafka.producer();
  await producer.connect();
  return producer;
};

type KafkaEventMessage = {
  key: string;
  value: string;
  headers?: Record<string, string>;
  topic?: string;
};

/**
 * Publishes an event to Kafka, defaulting to the primary reservations topic.
 */
export const publishEvent = async (message: KafkaEventMessage): Promise<RecordMetadata[]> => {
  const producerInstance = await getProducer();
  return producerInstance.send({
    topic: message.topic ?? kafkaConfig.topic,
    messages: [
      {
        key: message.key,
        value: message.value,
        headers: message.headers,
      },
    ],
  });
};

/**
 * Publishes a payload to the configured dead-letter topic.
 */
export const publishDlqEvent = async (
  message: Omit<KafkaEventMessage, "topic">,
): Promise<RecordMetadata[]> => {
  return publishEvent({
    ...message,
    topic: kafkaConfig.dlqTopic,
  });
};

/**
 * Disconnects the shared Kafka producer (used during graceful shutdown).
 */
export const shutdownProducer = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
};
