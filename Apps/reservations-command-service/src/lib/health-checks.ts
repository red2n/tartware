import { kafkaConfig } from "../config.js";
import { kafka } from "../kafka/client.js";

import { query } from "./db.js";

/**
 * Executes a lightweight query to verify database availability.
 */
export const checkDatabaseHealth = async (): Promise<void> => {
  await query("SELECT 1");
};

/**
 * Ensures Kafka connectivity by fetching metadata for the reservations topic.
 */
export const checkKafkaHealth = async (): Promise<void> => {
  const admin = kafka.admin();
  try {
    await admin.connect();
    await admin.fetchTopicMetadata({
      topics: [kafkaConfig.topic],
    });
  } finally {
    try {
      await admin.disconnect();
    } catch {
      // Ignore disconnect errors during health probes.
    }
  }
};
