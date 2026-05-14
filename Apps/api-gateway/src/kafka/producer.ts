import { createKafkaClient } from "@tartware/command-consumer-utils/producer";
import type { ProducerRecord } from "kafkajs";

import { kafkaConfig } from "../config.js";
import { gatewayLogger } from "../logger.js";

const kafka = createKafkaClient({
  clientId: kafkaConfig.clientId,
  brokers: kafkaConfig.brokers,
  logger: gatewayLogger,
});

const logger = gatewayLogger.child({ module: "command-producer" });

const producer = kafka.producer({
  allowAutoTopicCreation: false,
});

export const startProducer = async (): Promise<void> => {
  await producer.connect();
  logger.info(
    { clientId: kafkaConfig.clientId, brokers: kafkaConfig.brokers },
    "kafka producer connected",
  );
};

export const shutdownProducer = async (): Promise<void> => {
  await producer.disconnect();
  logger.info("kafka producer disconnected");
};

export const publishRecord = async (record: ProducerRecord): Promise<void> => {
  await producer.send(record);
};
