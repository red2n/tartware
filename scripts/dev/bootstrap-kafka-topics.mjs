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

/**
 * Partitions are Kafka's unit of consumer parallelism: a consumer group can
 * have at most one consumer per partition, so the partition count is a hard
 * ceiling on how many commands a domain can apply concurrently — replicas past
 * that number sit idle. At roughly 200 commands/sec per partition, twelve caps
 * a domain near 2,400/sec however the cluster is scaled.
 *
 * `COMMAND_TOPIC_PARTITIONS` therefore sizes the two hot topics from the target
 * rate: partitions ≈ target ÷ 200, rounded up with headroom. Partitions are
 * cheap (a few MB of broker memory each); being short is not.
 *
 * Raising this on an existing topic is not free. Kafka maps a key to a
 * partition by hashing it modulo the partition count, so adding partitions
 * remaps keys — two commands for one reservation can briefly sit on different
 * partitions and lose their relative order. Repartition when the topic is
 * drained, or accept that ordering is only guaranteed from that point forward.
 */
const hotTopicPartitions = Number(process.env.COMMAND_TOPIC_PARTITIONS ?? 128);

const topics = [
  {
    topic: "commands.primary",
    numPartitions: hotTopicPartitions,
    replicationFactor: 1,
    configEntries: [
      { name: "cleanup.policy", value: "compact" },
      { name: "compression.type", value: "producer" },
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
    numPartitions: hotTopicPartitions,
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
  {
    topic: "availability-guard.notifications",
    numPartitions: 3,
    replicationFactor: 1,
  },
  {
    topic: "notifications.events",
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

/**
 * Grow any existing topic that is below its configured partition count.
 *
 * Kafka can add partitions but never remove them, so this only ever increases.
 * Adding partitions rehashes key → partition, so two commands for the same
 * reservation can straddle the boundary and lose their relative order for as
 * long as the older messages are still unconsumed. Drain first when ordering
 * matters; the warning below says so rather than leaving it to be discovered.
 */
const growPartitions = async (admin, desired, existingTopics) => {
  const present = desired.filter((topic) => existingTopics.has(topic.topic));
  if (present.length === 0) {
    return;
  }

  const metadata = await admin.fetchTopicMetadata({
    topics: present.map((topic) => topic.topic),
  });
  const currentCounts = new Map(
    metadata.topics.map((topic) => [topic.name, topic.partitions.length])
  );

  const toGrow = present
    .filter((topic) => (currentCounts.get(topic.topic) ?? 0) < topic.numPartitions)
    .map((topic) => ({ topic: topic.topic, count: topic.numPartitions }));

  if (toGrow.length === 0) {
    return;
  }

  for (const { topic, count } of toGrow) {
    console.log(`↗️  ${topic}: ${currentCounts.get(topic)} → ${count} partitions`);
  }
  console.warn(
    "⚠️  Adding partitions rehashes keys: ordering per aggregate is only guaranteed\n" +
      "    for messages produced from now on. Repartition on a drained topic to avoid it."
  );

  // Creating a hundred-odd partitions takes longer than the client's default
  // 5s admin timeout; without this the call reports REQUEST_TIMED_OUT after the
  // broker has already done the work, and the script fails on a success.
  await admin.createPartitions({
    topicPartitions: toGrow,
    validateOnly: false,
    timeout: Number(process.env.KAFKA_ADMIN_TIMEOUT_MS ?? 60_000),
  });
};

const main = async () => {
  console.log(`🔌 Connecting to Kafka brokers: ${brokers.join(", ")}`);
  await admin.connect();

  const existingTopics = new Set(await admin.listTopics());
  const missingTopics = topics.filter((topic) => !existingTopics.has(topic.topic));

  if (missingTopics.length > 0) {
    console.log(
      `📦 Creating ${missingTopics.length} topic(s): ${missingTopics
        .map((topic) => topic.topic)
        .join(", ")}`
    );
    await admin.createTopics({ topics: missingTopics, waitForLeaders: true });
  }

  // Creating only what is missing leaves a topic that already exists at
  // whatever partition count it was born with. Raising the target and
  // re-running would then report success and change nothing, which is how a
  // throughput ceiling survives the change meant to lift it.
  await growPartitions(admin, topics, existingTopics);

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
