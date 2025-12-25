import { kafkaConfig, reliabilityConfig } from "../config.js";
import { kafka } from "../kafka/client.js";
import { query } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";

const kafkaDisabled = process.env.DISABLE_KAFKA === "true";

type OutboxStatus = "PENDING" | "FAILED" | "IN_PROGRESS" | "DLQ";

type OutboxStatsRow = {
  status: OutboxStatus;
  count: string;
  oldest_available_at: Date | string | null;
  last_status_at: Date | string | null;
};

type ConsumerOffsetRow = {
  partition: number;
  last_processed_offset: string;
  processed_at: Date | string | null;
};

type TopicOffsetEntry = {
  partition: number;
  offset: string;
  high: string;
  low: string;
};

type ConsumerPartitionSnapshot = {
  partition: number;
  offset: string | null;
  processedAt: string | null;
  lag: number | null;
  highWatermark: string | null;
};

type OutboxSnapshot = {
  pending: number;
  failed: number;
  inProgress: number;
  dlq: number;
  oldestPendingAt: string | null;
  oldestPendingAgeSeconds: number | null;
  lastFailureAt: string | null;
  lastDlqAt: string | null;
};

type KafkaOffsetsSnapshot = {
  reachable: boolean;
  disabled: boolean;
  error: string | null;
  topicOffsets: TopicOffsetEntry[] | null;
  topicError: string | null;
  dlqOffsets: TopicOffsetEntry[] | null;
  dlqError: string | null;
};

type DlqTopicSnapshot = {
  depth: number | null;
  latestOffset: string | null;
  earliestOffset: string | null;
};

export type ReliabilitySnapshot = {
  generatedAt: string;
  status: "healthy" | "degraded";
  issues: string[];
  outbox: OutboxSnapshot;
  consumer: {
    topic: string;
    consumerGroup: string;
    partitions: ConsumerPartitionSnapshot[];
    lastProcessedAt: string | null;
    maxLag: number | null;
    kafka: {
      reachable: boolean;
      error: string | null;
      topicError: string | null;
    };
  };
  dlqTopic: {
    topic: string;
    depth: number | null;
    latestOffset: string | null;
    earliestOffset: string | null;
    kafka: {
      reachable: boolean;
      error: string | null;
    };
  };
};

export const getReliabilitySnapshot =
  async (): Promise<ReliabilitySnapshot> => {
    const [outbox, consumerOffsets, kafkaSnapshot] = await Promise.all([
      fetchOutboxStats(),
      fetchConsumerOffsets(),
      fetchKafkaOffsets(),
    ]);

    const partitionStats = buildPartitionSnapshots(
      consumerOffsets,
      kafkaSnapshot.topicOffsets,
    );
    const lastProcessedAt = deriveLatestProcessedAt(partitionStats);
    const maxLag = deriveMaxLag(partitionStats);
    const dlqMetrics = computeDlqSnapshot(kafkaSnapshot.dlqOffsets);

    const issues = buildIssues({
      outbox,
      maxLag,
      dlqDepth: dlqMetrics.depth,
      kafkaSnapshot,
    });

    return {
      generatedAt: new Date().toISOString(),
      status: issues.length > 0 ? "degraded" : "healthy",
      issues,
      outbox,
      consumer: {
        topic: kafkaConfig.topic,
        consumerGroup: kafkaConfig.consumerGroupId,
        partitions: partitionStats,
        lastProcessedAt,
        maxLag,
        kafka: {
          reachable: kafkaSnapshot.reachable,
          error: kafkaSnapshot.error,
          topicError: kafkaSnapshot.topicError,
        },
      },
      dlqTopic: {
        topic: kafkaConfig.dlqTopic,
        depth: dlqMetrics.depth,
        latestOffset: dlqMetrics.latestOffset,
        earliestOffset: dlqMetrics.earliestOffset,
        kafka: {
          reachable:
            kafkaSnapshot.reachable && kafkaSnapshot.dlqOffsets !== null,
          error: kafkaSnapshot.dlqError ?? kafkaSnapshot.error,
        },
      },
    };
  };

const fetchOutboxStats = async (): Promise<OutboxSnapshot> => {
  const result = await query<OutboxStatsRow>(
    `
      SELECT
        status,
        COUNT(*)::text AS count,
        MIN(available_at) FILTER (
          WHERE status IN ('PENDING', 'FAILED')
        ) AS oldest_available_at,
        MAX(COALESCE(updated_at, created_at)) AS last_status_at
      FROM transactional_outbox
      WHERE status IN ('PENDING', 'FAILED', 'IN_PROGRESS', 'DLQ')
      GROUP BY status
    `,
  );

  let pending = 0;
  let failed = 0;
  let inProgress = 0;
  let dlq = 0;
  let oldestPendingAt: Date | null = null;
  let lastFailureAt: string | null = null;
  let lastDlqAt: string | null = null;

  for (const row of result.rows) {
    const count = Number(row.count ?? "0");
    switch (row.status) {
      case "PENDING": {
        pending = count;
        break;
      }
      case "FAILED": {
        failed = count;
        lastFailureAt = toIsoString(row.last_status_at);
        break;
      }
      case "IN_PROGRESS": {
        inProgress = count;
        break;
      }
      case "DLQ": {
        dlq = count;
        lastDlqAt = toIsoString(row.last_status_at);
        break;
      }
    }

    if (
      (row.status === "PENDING" || row.status === "FAILED") &&
      row.oldest_available_at
    ) {
      const candidate = new Date(row.oldest_available_at);
      if (!Number.isNaN(candidate.getTime())) {
        if (!oldestPendingAt || candidate < oldestPendingAt) {
          oldestPendingAt = candidate;
        }
      }
    }
  }

  return {
    pending,
    failed,
    inProgress,
    dlq,
    oldestPendingAt: oldestPendingAt ? oldestPendingAt.toISOString() : null,
    oldestPendingAgeSeconds: oldestPendingAt
      ? Math.floor((Date.now() - oldestPendingAt.getTime()) / 1000)
      : null,
    lastFailureAt,
    lastDlqAt,
  };
};

const fetchConsumerOffsets = async (): Promise<ConsumerOffsetRow[]> => {
  const result = await query<ConsumerOffsetRow>(
    `
      SELECT
        partition,
        last_processed_offset,
        processed_at
      FROM reservation_event_offsets
      WHERE consumer_group = $1
        AND topic = $2
      ORDER BY partition ASC
    `,
    [kafkaConfig.consumerGroupId, kafkaConfig.topic],
  );
  return result.rows;
};

const fetchKafkaOffsets = async (): Promise<KafkaOffsetsSnapshot> => {
  if (kafkaDisabled) {
    const message = "Kafka disabled via DISABLE_KAFKA";
    return {
      reachable: false,
      disabled: true,
      error: message,
      topicOffsets: null,
      topicError: message,
      dlqOffsets: null,
      dlqError: message,
    };
  }

  const admin = kafka.admin();
  let connected = false;
  try {
    await admin.connect();
    connected = true;
    const [topicOffsetsResult, dlqOffsetsResult] = await Promise.allSettled([
      admin.fetchTopicOffsets(kafkaConfig.topic),
      admin.fetchTopicOffsets(kafkaConfig.dlqTopic),
    ]);

    const topicSnapshot =
      topicOffsetsResult.status === "fulfilled"
        ? topicOffsetsResult.value
        : null;
    const topicError =
      topicOffsetsResult.status === "rejected"
        ? normalizeError(topicOffsetsResult.reason)
        : null;

    const dlqSnapshot =
      dlqOffsetsResult.status === "fulfilled" ? dlqOffsetsResult.value : null;
    const dlqError =
      dlqOffsetsResult.status === "rejected"
        ? normalizeError(dlqOffsetsResult.reason)
        : null;

    return {
      reachable: true,
      disabled: false,
      error: null,
      topicOffsets: topicSnapshot,
      topicError,
      dlqOffsets: dlqSnapshot,
      dlqError,
    };
  } catch (error) {
    const message = normalizeError(error);
    reservationsLogger.warn(
      { err: error },
      "Failed to fetch Kafka offsets for reliability snapshot",
    );
    return {
      reachable: connected,
      disabled: false,
      error: message,
      topicOffsets: null,
      topicError: message,
      dlqOffsets: null,
      dlqError: message,
    };
  } finally {
    try {
      await admin.disconnect();
    } catch {
      // ignore disconnect errors
    }
  }
};

const buildPartitionSnapshots = (
  consumerOffsets: ConsumerOffsetRow[],
  topicOffsets: TopicOffsetEntry[] | null,
): ConsumerPartitionSnapshot[] => {
  const partitions = new Set<number>();
  const consumerMap = new Map<number, ConsumerOffsetRow>();
  for (const row of consumerOffsets) {
    partitions.add(row.partition);
    consumerMap.set(row.partition, row);
  }

  const kafkaMap = new Map<number, TopicOffsetEntry>();
  for (const entry of topicOffsets ?? []) {
    partitions.add(entry.partition);
    kafkaMap.set(entry.partition, entry);
  }

  return Array.from(partitions)
    .sort((a, b) => a - b)
    .map((partition) => {
      const consumerEntry = consumerMap.get(partition);
      const kafkaEntry = kafkaMap.get(partition);
      const lastProcessedOffset = consumerEntry?.last_processed_offset ?? null;
      const processedAt = toIsoString(consumerEntry?.processed_at);
      const highWatermark = kafkaEntry?.high ?? kafkaEntry?.offset ?? null;
      const lag = computeLag(highWatermark, lastProcessedOffset);
      return {
        partition,
        offset: lastProcessedOffset,
        processedAt,
        lag,
        highWatermark,
      };
    });
};

const deriveLatestProcessedAt = (
  partitions: ConsumerPartitionSnapshot[],
): string | null => {
  let latest: string | null = null;
  for (const partition of partitions) {
    if (!partition.processedAt) {
      continue;
    }
    if (!latest || partition.processedAt > latest) {
      latest = partition.processedAt;
    }
  }
  return latest;
};

const deriveMaxLag = (
  partitions: ConsumerPartitionSnapshot[],
): number | null => {
  let maxLag: number | null = null;
  for (const partition of partitions) {
    if (partition.lag === null) {
      continue;
    }
    if (maxLag === null || partition.lag > maxLag) {
      maxLag = partition.lag;
    }
  }
  return maxLag;
};

const computeDlqSnapshot = (
  offsets: TopicOffsetEntry[] | null,
): DlqTopicSnapshot => {
  if (!offsets || offsets.length === 0) {
    return {
      depth: null,
      latestOffset: null,
      earliestOffset: null,
    };
  }

  let totalDepth = 0n;
  let latest: bigint | null = null;
  let earliest: bigint | null = null;
  let hasDepthSample = false;

  for (const entry of offsets) {
    const high = parseKafkaOffset(entry.high ?? entry.offset);
    const low = parseKafkaOffset(entry.low);
    if (high !== null && low !== null && high >= low) {
      totalDepth += high - low;
      hasDepthSample = true;
    }
    if (high !== null && (latest === null || high > latest)) {
      latest = high;
    }
    if (low !== null && (earliest === null || low < earliest)) {
      earliest = low;
    }
  }

  return {
    depth: hasDepthSample ? toSafeNumber(totalDepth) : null,
    latestOffset: latest !== null ? latest.toString() : null,
    earliestOffset: earliest !== null ? earliest.toString() : null,
  };
};

const buildIssues = (input: {
  outbox: OutboxSnapshot;
  maxLag: number | null;
  dlqDepth: number | null;
  kafkaSnapshot: KafkaOffsetsSnapshot;
}): string[] => {
  const issues: string[] = [];

  if (input.outbox.pending > reliabilityConfig.outboxPendingWarning) {
    issues.push(
      `Pending outbox backlog ${input.outbox.pending} exceeds warning threshold ${reliabilityConfig.outboxPendingWarning}`,
    );
  }
  if (input.outbox.failed > reliabilityConfig.outboxFailedWarning) {
    issues.push(
      `Failed outbox rows detected (${input.outbox.failed}) exceeding threshold ${reliabilityConfig.outboxFailedWarning}`,
    );
  }
  if (input.outbox.dlq > reliabilityConfig.outboxDlqWarning) {
    issues.push(
      `Outbox DLQ backlog ${input.outbox.dlq} exceeds threshold ${reliabilityConfig.outboxDlqWarning}`,
    );
  }
  if (
    typeof input.maxLag === "number" &&
    input.maxLag > reliabilityConfig.consumerLagWarning
  ) {
    issues.push(
      `Kafka consumer lag ${input.maxLag} exceeds threshold ${reliabilityConfig.consumerLagWarning}`,
    );
  }
  if (
    typeof input.dlqDepth === "number" &&
    input.dlqDepth > reliabilityConfig.dlqDepthWarning
  ) {
    issues.push(
      `DLQ topic depth ${input.dlqDepth} exceeds threshold ${reliabilityConfig.dlqDepthWarning}`,
    );
  }
  if (!input.kafkaSnapshot.reachable) {
    issues.push(input.kafkaSnapshot.error ?? "Kafka offsets unavailable");
  } else {
    if (input.kafkaSnapshot.topicError) {
      issues.push(
        `Failed to fetch primary topic offsets: ${input.kafkaSnapshot.topicError}`,
      );
    }
    if (input.kafkaSnapshot.dlqError) {
      issues.push(
        `Failed to fetch DLQ topic offsets: ${input.kafkaSnapshot.dlqError}`,
      );
    }
  }

  return issues;
};

const computeLag = (
  highWatermark: string | null,
  lastProcessedOffset: string | null,
): number | null => {
  const high = parseKafkaOffset(highWatermark);
  if (high === null) {
    return null;
  }
  if (!lastProcessedOffset) {
    return toSafeNumber(high);
  }
  const last = parseKafkaOffset(lastProcessedOffset);
  if (last === null) {
    return toSafeNumber(high);
  }
  const diff = high - last - 1n;
  if (diff <= 0n) {
    return 0;
  }
  return toSafeNumber(diff);
};

const parseKafkaOffset = (value: string | null | undefined): bigint | null => {
  if (value === undefined || value === null || value === "" || value === "-1") {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const toSafeNumber = (value: bigint): number => {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > max) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (value < BigInt(0)) {
    return 0;
  }
  return Number(value);
};

const toIsoString = (
  value: Date | string | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const normalizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};
