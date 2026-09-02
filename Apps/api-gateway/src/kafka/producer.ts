import { createKafkaClient } from "@tartware/command-consumer-utils/producer";
import type { TopicMessages } from "kafkajs";

import { kafkaConfig } from "../config.js";
import { gatewayLogger } from "../logger.js";

const kafka = createKafkaClient({
  clientId: kafkaConfig.clientId,
  brokers: kafkaConfig.brokers,
  logger: gatewayLogger,
  component: "command-producer",
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

/**
 * Publish many records — across however many topics — in one broker request.
 *
 * `send()` awaits an acknowledgement per call, so publishing a claimed outbox
 * batch one row at a time serialises the dispatcher behind a round trip per
 * command. `sendBatch` pays that latency once for the whole batch, which is
 * what lets a single dispatcher keep up with a fleet of gateways accepting
 * commands.
 */
export const publishRecordBatch = async (topicMessages: TopicMessages[]): Promise<void> => {
  if (topicMessages.length === 0) {
    return;
  }
  await producer.sendBatch({ topicMessages });
};
