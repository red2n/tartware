import { kafkaConfig, reliabilityConfig } from "../config.js";
import { kafka } from "../kafka/client.js";
import { query } from "../lib/db.js";
import { setDlqDepth, setDlqThresholds } from "../lib/metrics.js";
import { reservationsLogger } from "../logger.js";
import { countPendingOutboxRows } from "../outbox/repository.js";

type ConsumerStats = {
  partitions: number;
  stalePartitions: number;
  maxSecondsSinceCommit: number | null;
};

type LifecycleStats = {
  stalledCommands: number;
  oldestStuckSeconds: number | null;
  dlqTotal: number;
};

type DlqStats = {
  depth: number | null;
  error?: string;
};

type ReliabilityStatus = "healthy" | "degraded" | "critical";

/**
 * Reliability snapshot for reservation command pipeline.
 */
export type ReliabilitySnapshot = {
  status: ReliabilityStatus;
  generatedAt: string;
  issues: string[];
  outbox: {
    pending: number;
    warnThreshold: number;
    criticalThreshold: number;
  };
  consumer: ConsumerStats & {
    staleThresholdSeconds: number;
  };
  lifecycle: LifecycleStats & {
    stalledThresholdSeconds: number;
  };
  dlq: {
    depth: number | null;
    warnThreshold: number;
    criticalThreshold: number;
    topic: string;
    error: string | null;
  };
};

const STATUS_ORDER: ReliabilityStatus[] = ["healthy", "degraded", "critical"];

const escalateStatus = (current: ReliabilityStatus, next: ReliabilityStatus): ReliabilityStatus => {
  const currentIdx = STATUS_ORDER.indexOf(current);
  const nextIdx = STATUS_ORDER.indexOf(next);
  return STATUS_ORDER[Math.max(currentIdx, nextIdx)];
};

const fetchConsumerStats = async (): Promise<ConsumerStats> => {
  const { rows } = await query<{
    partitions: string | null;
    stale_partitions: string | null;
    max_seconds_since_commit: number | null;
  }>(
    `
      SELECT
        COUNT(*)::text AS partitions,
        COUNT(*) FILTER (
          WHERE processed_at < NOW() - ($2::int * interval '1 second')
        )::text AS stale_partitions,
        MAX(EXTRACT(EPOCH FROM (NOW() - processed_at))) AS max_seconds_since_commit
      FROM reservation_event_offsets
      WHERE consumer_group = $1
    `,
    [kafkaConfig.consumerGroupId, reliabilityConfig.consumerStaleSeconds],
  );

  const row = rows[0];
  return {
    partitions: Number(row?.partitions ?? "0"),
    stalePartitions: Number(row?.stale_partitions ?? "0"),
    maxSecondsSinceCommit:
      row?.max_seconds_since_commit !== null && row?.max_seconds_since_commit !== undefined
        ? Number(row.max_seconds_since_commit)
        : null,
  };
};

const fetchLifecycleStats = async (): Promise<LifecycleStats> => {
  const { rows } = await query<{
    stalled_commands: string | null;
    oldest_stuck_seconds: number | null;
    dlq_total: string | null;
  }>(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE current_state NOT IN ('APPLIED', 'DLQ')
            AND updated_at < NOW() - ($1::int * interval '1 second')
        )::text AS stalled_commands,
        MAX(
          EXTRACT(EPOCH FROM (NOW() - updated_at))
        ) FILTER (
          WHERE current_state NOT IN ('APPLIED', 'DLQ')
            AND updated_at < NOW() - ($1::int * interval '1 second')
        ) AS oldest_stuck_seconds,
        COUNT(*) FILTER (
          WHERE current_state = 'DLQ'
        )::text AS dlq_total
      FROM reservation_command_lifecycle
    `,
    [reliabilityConfig.stalledThresholdSeconds],
  );

  const row = rows[0];
  return {
    stalledCommands: Number(row?.stalled_commands ?? "0"),
    oldestStuckSeconds:
      row?.oldest_stuck_seconds !== null && row?.oldest_stuck_seconds !== undefined
        ? Number(row.oldest_stuck_seconds)
        : null,
    dlqTotal: Number(row?.dlq_total ?? "0"),
  };
};

const fetchDlqStats = async (): Promise<DlqStats> => {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const offsets = await admin.fetchTopicOffsets(kafkaConfig.dlqTopic);

    const depth = offsets.reduce((total, partitionOffsets) => {
      const high = safeBigInt(partitionOffsets.high ?? partitionOffsets.offset ?? "0");
      const low = safeBigInt(partitionOffsets.low ?? "0");
      const partitionDepth = high - low;
      return total + Number(partitionDepth > 0n ? partitionDepth : 0n);
    }, 0);

    return { depth };
  } catch (error) {
    reservationsLogger.warn(
      { err: error, topic: kafkaConfig.dlqTopic },
      "Failed to fetch DLQ depth",
    );
    return {
      depth: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      await admin.disconnect();
    } catch {
      // ignore
    }
  }
};

const safeBigInt = (value: string | number): bigint => {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

/**
 * Compute reliability snapshot for outbox, consumers, lifecycle, and DLQ.
 */
export const getReliabilitySnapshot = async (): Promise<ReliabilitySnapshot> => {
  const [outboxPending, consumer, lifecycle, dlq] = await Promise.all([
    countPendingOutboxRows(),
    fetchConsumerStats(),
    fetchLifecycleStats(),
    fetchDlqStats(),
  ]);

  setDlqThresholds(reliabilityConfig.dlqWarnThreshold, reliabilityConfig.dlqCriticalThreshold);
  let status: ReliabilityStatus = "healthy";
  const issues: string[] = [];

  if (outboxPending >= reliabilityConfig.outboxCriticalThreshold) {
    status = escalateStatus(status, "critical");
    issues.push(
      `Outbox backlog (${outboxPending}) exceeds critical threshold ${reliabilityConfig.outboxCriticalThreshold}`,
    );
  } else if (outboxPending >= reliabilityConfig.outboxWarnThreshold) {
    status = escalateStatus(status, "degraded");
    issues.push(
      `Outbox backlog (${outboxPending}) exceeds warning threshold ${reliabilityConfig.outboxWarnThreshold}`,
    );
  }

  if (consumer.stalePartitions > 0) {
    status = escalateStatus(status, "degraded");
    issues.push(
      `${consumer.stalePartitions} consumer partition(s) exceeded ${reliabilityConfig.consumerStaleSeconds}s without commits`,
    );
  }

  if (lifecycle.stalledCommands > 0) {
    status = escalateStatus(status, "degraded");
    issues.push(
      `${lifecycle.stalledCommands} command(s) stuck beyond ${reliabilityConfig.stalledThresholdSeconds}s`,
    );
  }

  if (lifecycle.dlqTotal > 0) {
    status = escalateStatus(status, "degraded");
    issues.push(`${lifecycle.dlqTotal} command(s) currently in DLQ state`);
  }

  if (dlq.depth === null) {
    status = escalateStatus(status, "degraded");
    issues.push(
      `Unable to determine DLQ backlog for ${kafkaConfig.dlqTopic}${
        dlq.error ? ` (${dlq.error})` : ""
      }`,
    );
  } else {
    setDlqDepth(dlq.depth);
    if (dlq.depth >= reliabilityConfig.dlqCriticalThreshold) {
      status = escalateStatus(status, "critical");
      issues.push(
        `DLQ backlog (${dlq.depth}) exceeds critical threshold ${reliabilityConfig.dlqCriticalThreshold}`,
      );
    } else if (dlq.depth >= reliabilityConfig.dlqWarnThreshold) {
      status = escalateStatus(status, "degraded");
      issues.push(
        `DLQ backlog (${dlq.depth}) exceeds warning threshold ${reliabilityConfig.dlqWarnThreshold}`,
      );
    }
  }

  return {
    status,
    generatedAt: new Date().toISOString(),
    issues,
    outbox: {
      pending: outboxPending,
      warnThreshold: reliabilityConfig.outboxWarnThreshold,
      criticalThreshold: reliabilityConfig.outboxCriticalThreshold,
    },
    consumer: {
      ...consumer,
      staleThresholdSeconds: reliabilityConfig.consumerStaleSeconds,
    },
    lifecycle: {
      ...lifecycle,
      stalledThresholdSeconds: reliabilityConfig.stalledThresholdSeconds,
    },
    dlq: {
      depth: dlq.depth,
      warnThreshold: reliabilityConfig.dlqWarnThreshold,
      criticalThreshold: reliabilityConfig.dlqCriticalThreshold,
      topic: kafkaConfig.dlqTopic,
      error: dlq.error ?? null,
    },
  };
};
