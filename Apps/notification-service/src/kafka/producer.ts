import type { Producer, RecordMetadata } from "kafkajs";

import { config } from "../config.js";

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
 * Publish an event to the notification events topic or a custom topic.
 */
export const publishEvent = async (message: KafkaEventMessage): Promise<RecordMetadata[]> => {
  const producerInstance = await getProducer();
  return producerInstance.send({
    topic: message.topic ?? config.notificationEvents.topic,
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
 * Publish a failed message to the command center DLQ topic.
 */
export const publishDlqEvent = async (
  message: Omit<KafkaEventMessage, "topic">,
): Promise<RecordMetadata[]> => {
  return publishEvent({
    ...message,
    topic: config.commandCenter.dlqTopic,
  });
};

export const shutdownProducer = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
};
