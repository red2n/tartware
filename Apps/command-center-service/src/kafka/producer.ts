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

type KafkaCommandMessage = {
  key: string;
  value: string;
  headers?: Record<string, string>;
  topic?: string;
};

export const publishCommandEvent = async (
  message: KafkaCommandMessage,
): Promise<RecordMetadata[]> => {
  const producerInstance = await getProducer();
  return producerInstance.send({
    topic: message.topic ?? config.kafka.topic,
    messages: [
      {
        key: message.key,
        value: message.value,
        headers: message.headers,
      },
    ],
  });
};

export const publishCommandDlqEvent = async (
  message: Omit<KafkaCommandMessage, "topic">,
): Promise<RecordMetadata[]> => {
  return publishCommandEvent({
    ...message,
    topic: config.kafka.dlqTopic,
  });
};

export const shutdownProducer = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
};
