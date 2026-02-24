import { createKafkaClient } from "@tartware/command-consumer-utils/producer";

import { config } from "../config.js";

export const kafka = createKafkaClient({
	clientId: config.kafka.clientId,
	brokers: config.kafka.brokers,
	logLevel: "WARN",
});
