import { createKafkaClient } from "@tartware/command-consumer-utils/producer";

import { kafkaConfig } from "../config.js";

export const kafka = createKafkaClient({
	clientId: kafkaConfig.clientId,
	brokers: kafkaConfig.brokers,
	logLevel: "ERROR",
});
