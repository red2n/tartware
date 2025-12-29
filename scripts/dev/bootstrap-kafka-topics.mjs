#!/usr/bin/env node

/**
 * Ensures the local Kafka cluster has all topics required for dev workflows.
 *
 * Usage:
 *   KAFKA_BROKERS=localhost:29092 node scripts/dev/bootstrap-kafka-topics.mjs
 */

import { Kafka, logLevel } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS ?? "localhost:29092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

if (brokers.length === 0) {
  console.error("✗ No Kafka brokers configured. Set KAFKA_BROKERS or start docker compose.");
  process.exit(1);
}

const topics = [
  {
    topic: "commands.primary",
    numPartitions: 12,
    replicationFactor: 1,
    configEntries: [
      { name: "cleanup.policy", value: "compact" },
      { name: "compression.type", value: "zstd" },
    ],
  },
  {
    topic: "commands.primary.dlq",
    numPartitions: 6,
    replicationFactor: 1,
    configEntries: [
      { name: "cleanup.policy", value: "delete" },
      { name: "retention.ms", value: `${7 * 24 * 60 * 60 * 1000}` }, // 7 days
    ],
  },
  {
    topic: "reservations.events",
    numPartitions: 12,
    replicationFactor: 1,
  },
  {
    topic: "reservations.events.dlq",
    numPartitions: 6,
    replicationFactor: 1,
    configEntries: [
      { name: "cleanup.policy", value: "delete" },
      { name: "retention.ms", value: `${7 * 24 * 60 * 60 * 1000}` },
    ],
  },
  {
    topic: "inventory.events.shadow",
    numPartitions: 6,
    replicationFactor: 1,
  },
  {
    topic: "inventory.events.dlq",
    numPartitions: 3,
    replicationFactor: 1,
  },
  {
    topic: "roll.events.shadow",
    numPartitions: 6,
    replicationFactor: 1,
  },
];

const clientId = process.env.KAFKA_CLIENT_ID ?? "tartware-kafka-bootstrapper";

const kafka = new Kafka({
  clientId,
  brokers,
  logLevel: logLevel.NOTHING,
});

const admin = kafka.admin();

const main = async () => {
  console.log(`🔌 Connecting to Kafka brokers: ${brokers.join(", ")}`);
  await admin.connect();

  const existingTopics = new Set(await admin.listTopics());
  const missingTopics = topics.filter((topic) => !existingTopics.has(topic.topic));

  if (missingTopics.length === 0) {
    console.log("✅ All required topics already exist.");
    return;
  }

  console.log(
    `📦 Creating ${missingTopics.length} topic(s): ${missingTopics
      .map((topic) => topic.topic)
      .join(", ")}`
  );

  await admin.createTopics({
    topics: missingTopics,
    waitForLeaders: true,
  });

  console.log("🎉 Kafka topics bootstrapped successfully.");
};

main()
  .catch((error) => {
    console.error("✗ Failed to bootstrap Kafka topics:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await admin.disconnect();
    } catch (error) {
      console.warn("⚠️  Failed to disconnect Kafka admin client:", error);
    }
  });
