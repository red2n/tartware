/**
 * Drains accepted commands from the transactional outbox into Kafka.
 *
 * Accepting a command used to publish it inline: the request wrote the outbox
 * row, sent to Kafka, waited for the broker acknowledgement, then wrote two
 * more rows recording that it had. The outbox was paid for and never used —
 * every cost of a durable log with none of the benefit, on the one path that
 * has to scale.
 *
 * Now the request commits the outbox row and returns. This dispatcher is what
 * makes that safe: the row is durable, so a command survives a broker outage,
 * a gateway restart, or a crash mid-publish, and is delivered when the loop
 * next runs. `claimOutboxBatch` locks rows `FOR UPDATE SKIP LOCKED`, so every
 * gateway replica can run one without coordinating or double-publishing.
 *
 * Delivery is at-least-once, as it was before — consumers already de-duplicate
 * on `command_idempotency`.
 */

import type { OutboxRecord, OutboxStatus } from "@tartware/outbox";
import type { TopicMessages } from "kafkajs";

/** Only the rows this gateway enqueues; other producers own their own types. */
const COMMAND_AGGREGATE_TYPE = "command";

type DispatcherLogger = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

/** Tunables; see `commandOutboxConfig` for what each one trades off. */
export type CommandOutboxDispatcherSettings = {
  batchSize: number;
  idlePollIntervalMs: number;
  lockTimeoutMs: number;
  lockSweepEveryCycles: number;
  maxRetries: number;
  retryBackoffMs: number;
  workerId: string;
};

/**
 * Everything the loop needs from the outside world.
 *
 * Injected rather than imported so the dispatcher depends on these behaviours
 * and not on the gateway's database pool, Kafka producer, or clock — which is
 * what lets the batching, grouping, and backlog logic be tested without any of
 * them, and follows the direction set for new code in `AGENTS.md`.
 */
export type CommandOutboxDispatcherDeps = {
  settings: CommandOutboxDispatcherSettings;
  logger: DispatcherLogger;
  /** Topic used when a stored envelope predates the `targetTopic` field. */
  defaultTopic: string;
  claimOutboxBatch: (
    limit: number,
    workerId: string,
    aggregateType: string,
  ) => Promise<OutboxRecord[]>;
  publishRecordBatch: (topicMessages: TopicMessages[]) => Promise<void>;
  markOutboxDeliveredBatch: (ids: string[]) => Promise<number>;
  markOutboxFailed: (
    id: string,
    error: unknown,
    retryBackoffMs: number,
    maxRetries: number,
  ) => Promise<OutboxStatus>;
  releaseExpiredLocks: (lockTimeoutMs: number) => Promise<number>;
  updateCommandDispatchStatusBatch: (
    outboxEventIds: string[],
    status: "PUBLISHED",
  ) => Promise<void>;
};

/**
 * The topic chosen when the command was accepted, carried in the stored
 * envelope. Falling back to the default topic matches what the inline publish
 * did, so a row written before this field existed still routes somewhere real.
 */
const resolveTopic = (record: OutboxRecord, defaultTopic: string): string => {
  const metadata = record.payload?.metadata;
  if (metadata && typeof metadata === "object") {
    const targetTopic = (metadata as Record<string, unknown>).targetTopic;
    if (typeof targetTopic === "string" && targetTopic.length > 0) {
      return targetTopic;
    }
  }
  return defaultTopic;
};

const normalizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value !== undefined && value !== null) {
      normalized[key] = String(value);
    }
  }
  return normalized;
};

/**
 * Group a claimed batch into one `sendBatch` entry per topic.
 *
 * The message key stays `aggregateId` — the command id the inline publish
 * used — so partition assignment is unchanged by this refactor. The row's
 * `partitionKey` holds the tenant id and is deliberately *not* used: keying by
 * tenant would give per-tenant ordering, but it would also funnel every command
 * from the largest tenants onto a single partition, capping them at one
 * consumer's throughput. Changing that is a routing decision about ordering
 * guarantees, not something to alter while moving the publish off the request
 * path.
 *
 * Exported for tests: this is the part with arithmetic worth pinning down.
 */
export const groupByTopic = (records: OutboxRecord[], defaultTopic: string): TopicMessages[] => {
  const byTopic = new Map<string, TopicMessages>();

  for (const record of records) {
    const topic = resolveTopic(record, defaultTopic);
    const message = {
      key: record.aggregateId,
      value: JSON.stringify(record.payload),
      headers: normalizeHeaders(record.headers),
    };
    const existing = byTopic.get(topic);
    if (existing) {
      existing.messages.push(message);
    } else {
      byTopic.set(topic, { topic, messages: [message] });
    }
  }

  return [...byTopic.values()];
};

/**
 * Build a dispatcher bound to the given dependencies.
 *
 * Returns its own start/shutdown pair rather than mutating module state, so a
 * test can run one against fakes and the process can hold exactly one.
 */
export const createCommandOutboxDispatcher = (deps: CommandOutboxDispatcherDeps) => {
  const { settings, logger } = deps;

  let dispatcherTimer: NodeJS.Timeout | null = null;
  let running = false;
  let currentCycle: Promise<void> | null = null;
  let cyclesSinceLockSweep = 0;

  /**
   * Record a batch-wide publish failure per row.
   *
   * Per-row here is deliberate: `markOutboxFailed` decides retry-versus-DLQ from
   * each row's own retry count, and this runs only when a whole batch failed to
   * reach the broker — a path where correct backoff matters more than round
   * trips.
   */
  const recordBatchFailure = async (records: OutboxRecord[], error: unknown): Promise<void> => {
    await Promise.all(
      records.map((record) =>
        deps
          .markOutboxFailed(record.id, error, settings.retryBackoffMs, settings.maxRetries)
          .catch((failure) => {
            logger.error(
              { err: failure, recordId: record.id },
              "failed to record outbox publish failure",
            );
          }),
      ),
    );
  };

  /**
   * Claim and publish one batch.
   *
   * @returns whether the batch came back full, meaning a backlog remains and the
   * next cycle should run immediately instead of waiting out the idle interval.
   */
  const processBatch = async (): Promise<boolean> => {
    // A worker that died holding locks would otherwise strand its rows. Sweeping
    // every cycle would mean a full scan per poll, so it runs on a slow cadence.
    cyclesSinceLockSweep += 1;
    if (cyclesSinceLockSweep >= settings.lockSweepEveryCycles) {
      cyclesSinceLockSweep = 0;
      const released = await deps.releaseExpiredLocks(settings.lockTimeoutMs);
      if (released > 0) {
        logger.warn({ released }, "released expired command outbox locks");
      }
    }

    const records = await deps.claimOutboxBatch(
      settings.batchSize,
      settings.workerId,
      COMMAND_AGGREGATE_TYPE,
    );

    if (records.length === 0) {
      return false;
    }

    try {
      await deps.publishRecordBatch(groupByTopic(records, deps.defaultTopic));
    } catch (error) {
      logger.error(
        { err: error, batchSize: records.length },
        "failed to publish command outbox batch",
      );
      await recordBatchFailure(records, error);
      return false;
    }

    // Bookkeeping is two statements for the whole batch rather than two per
    // command, which is what keeps the dispatcher's cost flat as the batch grows.
    await deps.markOutboxDeliveredBatch(records.map((record) => record.id));
    await deps.updateCommandDispatchStatusBatch(
      records.map((record) => record.eventId),
      "PUBLISHED",
    );

    return records.length >= settings.batchSize;
  };

  const scheduleNextCycle = (immediate: boolean): void => {
    if (!running) {
      return;
    }
    dispatcherTimer = setTimeout(runCycle, immediate ? 0 : settings.idlePollIntervalMs);
  };

  const runCycle = async (): Promise<void> => {
    let hadFullBatch = false;

    currentCycle = processBatch()
      .then((full) => {
        hadFullBatch = full;
      })
      .catch((error) => {
        logger.error({ err: error }, "command outbox dispatcher cycle failed");
      });

    await currentCycle;
    scheduleNextCycle(hadFullBatch);
  };

  /** Start the drain loop. Safe to call twice; the second call is a no-op. */
  const start = (): void => {
    if (running) {
      return;
    }
    running = true;
    cyclesSinceLockSweep = 0;
    scheduleNextCycle(true);
    logger.info(
      {
        workerId: settings.workerId,
        batchSize: settings.batchSize,
        idlePollIntervalMs: settings.idlePollIntervalMs,
      },
      "command outbox dispatcher started",
    );
  };

  /** Stop the loop and wait for the in-flight batch, so shutdown loses nothing. */
  const shutdown = async (): Promise<void> => {
    if (!running) {
      return;
    }
    running = false;
    if (dispatcherTimer) {
      clearTimeout(dispatcherTimer);
      dispatcherTimer = null;
    }
    try {
      await currentCycle;
    } catch {
      // A failing final cycle is already logged; shutdown continues regardless.
    }
    logger.info("command outbox dispatcher stopped");
  };

  return { start, shutdown };
};
