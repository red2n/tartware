import { Kafka, logLevel, type ProducerRecord } from "kafkajs";

import { kafkaConfig } from "../config.js";
import { gatewayLogger } from "../logger.js";

const kafka = new Kafka({
	clientId: kafkaConfig.clientId,
	brokers: kafkaConfig.brokers,
	logLevel: logLevel.NOTHING,
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
