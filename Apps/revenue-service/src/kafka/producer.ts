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

export const publishEvent = async (message: KafkaEventMessage): Promise<RecordMetadata[]> => {
  const producerInstance = await getProducer();
  return producerInstance.send({
    topic: message.topic ?? config.commandCenter.topic,
    messages: [
      {
        key: message.key,
        value: message.value,
        headers: message.headers,
      },
    ],
  });
};

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
