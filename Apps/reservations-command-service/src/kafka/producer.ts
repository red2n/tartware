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
};

export const publishEvent = async (
  message: KafkaEventMessage,
): Promise<RecordMetadata[]> => {
  const producerInstance = await getProducer();
  return producerInstance.send({
    topic: kafkaConfig.topic,
    messages: [
      {
        key: message.key,
        value: message.value,
        headers: message.headers,
      },
    ],
  });
};

export const shutdownProducer = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
};
