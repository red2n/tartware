import { performance } from "node:perf_hooks";

import type { OverrideStepUpGrant } from "@tartware/schemas";
import type { EachBatchPayload, KafkaMessage } from "kafkajs";

export type CommandEnvelope = {
  metadata?: {
    commandId?: string;
    idempotencyKey?: string;
    commandName?: string;
    tenantId?: string;
    targetService?: string;
    correlationId?: string;
    requestId?: string;
    initiatedBy?: {
      userId?: string;
      role?: string;
    };
    /**
     * The supervisor who authorised this override at the terminal, when one did.
     *
     * Stamped by the gateway from a grant row it claimed; never settable by a
     * caller. `initiatedBy` stays the operator — the record has to say which is
     * which, which is A03's finding and the reason these are two fields rather
     * than one overwritten one.
     */
    stepUp?: OverrideStepUpGrant | null;
  };
  payload?: unknown;
};

export type CommandMetadata = NonNullable<CommandEnvelope["metadata"]> & {
  commandName: string;
  tenantId: string;
};

type RetryAttemptContext = {
  attempt: number;
  delayMs: number;
  error: unknown;
};

type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  delayScheduleMs?: number[];
  onRetry?: (context: RetryAttemptContext) => void;
  isRetryable?: (error: unknown) => boolean;
};

type ProcessWithRetry = (
  operation: () => Promise<unknown>,
  options: RetryOptions,
) => Promise<{ attempts: number }>;

type LoggerLike = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug?: (obj: unknown, msg?: string) => void;
};

type DlqFailureReason = "PARSING_ERROR" | "HANDLER_FAILURE";

type BuildDlqPayloadInput = {
  envelope?: CommandEnvelope;
  rawValue: string;
  topic: string;
  partition: number;
  offset: string;
  attempts: number;
  failureReason: DlqFailureReason;
  error: unknown;
};

type BuildDlqPayload = (input: BuildDlqPayloadInput) => unknown;

type PublishDlqEvent = (input: {
  key: string;
  value: string;
  headers?: Record<string, string>;
}) => Promise<unknown>;

type CommandConsumerMetrics = {
  recordOutcome?: (
    commandName: string,
    status: "success" | "parse_error" | "handler_error" | "duplicate",
  ) => void;
  observeDuration?: (commandName: string, durationSeconds: number) => void;
  setConsumerLag?: (topic: string, partition: number, lag: number) => void;
};

type IdempotencyCheck = (input: {
  tenantId: string;
  idempotencyKey: string;
  commandName: string;
}) => Promise<boolean>;

type IdempotencyRecord = (input: {
  tenantId: string;
  idempotencyKey: string;
  commandName: string;
  commandId?: string;
  processedAt: Date;
}) => Promise<void>;

type CreateCommandCenterHandlersInput = {
  targetServiceId: string;
  serviceName: string;
  logger: LoggerLike;
  retry: {
    maxRetries: number;
    baseDelayMs: number;
    delayScheduleMs?: number[];
    isRetryable?: (error: unknown) => boolean;
  };
  processWithRetry: ProcessWithRetry;
  RetryExhaustedError: new (...args: never[]) => Error & { attempts: number };
  publishDlqEvent: PublishDlqEvent;
  buildDlqPayload: BuildDlqPayload;
  routeCommand: (envelope: CommandEnvelope, metadata: CommandMetadata) => Promise<void>;
  commandLabel: string;
  metrics?: CommandConsumerMetrics;
  /**
   * Optional idempotency check - returns true if command was already processed.
   * When provided, duplicate commands will be skipped.
   */
  checkIdempotency?: IdempotencyCheck;
  /**
   * Optional callback to record a processed command for idempotency.
   * Called after successful command processing.
   */
  recordIdempotency?: IdempotencyRecord;
  /**
   * Behavior when the idempotency check fails.
   * - fail-open: log and proceed (default)
   * - fail-closed: route to DLQ and skip processing
   */
  idempotencyFailureMode?: "fail-open" | "fail-closed";
  /**
   * Records a whole batch's idempotency rows in one statement.
   *
   * Supplied together with {@link recordIdempotency}; when present the per
   * message insert is skipped and the batch is written once at the end, which
   * matches when offsets are committed anyway.
   */
  recordIdempotencyBatch?: (
    inputs: Array<{
      tenantId: string;
      idempotencyKey: string;
      commandName: string;
      commandId?: string;
      processedAt: Date;
    }>,
  ) => Promise<void>;
  /**
   * How many *distinct aggregates* within one batch are applied at once.
   *
   * Commands are keyed by the aggregate they mutate, so two messages with
   * different keys cannot depend on each other and are safe to overlap; two
   * with the same key must stay in order. Draining a batch strictly serially
   * spends most of its time waiting on database round trips that belong to
   * unrelated reservations.
   */
  batchConcurrency?: number;
};

/**
 * Run `worker` over `items` with at most `limit` in flight.
 *
 * Preserves nothing about ordering between items — the caller has already
 * grouped them so that anything order-dependent is inside a single item.
 */
const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  if (items.length === 0) {
    return;
  }
  const width = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  const runners = Array.from({ length: width }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++] as T;
      await worker(item);
    }
  });
  await Promise.all(runners);
};

export const createCommandCenterHandlers = (input: CreateCommandCenterHandlersInput) => {
  // Validate idempotency callbacks are properly paired
  const hasCheck = typeof input.checkIdempotency === "function";
  const hasRecord = typeof input.recordIdempotency === "function";
  if (hasCheck !== hasRecord) {
    throw new Error("checkIdempotency and recordIdempotency must both be provided or both omitted");
  }

  const idempotencyFailureMode = input.idempotencyFailureMode ?? "fail-open";
  const batchConcurrency = Math.max(1, Math.floor(Number(input.batchConcurrency ?? 16)) || 1);

  /**
   * Idempotency rows accumulated by the batch in flight, or null when batching
   * is not wired and each command records its own.
   */
  let pendingIdempotency: Array<{
    tenantId: string;
    idempotencyKey: string;
    commandName: string;
    commandId?: string;
    processedAt: Date;
  }> | null = null;

  const shouldProcess = (metadata: CommandEnvelope["metadata"]): metadata is CommandMetadata => {
    if (!metadata) {
      input.logger.debug?.(
        { label: input.commandLabel },
        "shouldProcess: metadata is null/undefined",
      );
      return false;
    }
    if (metadata.targetService && metadata.targetService !== input.targetServiceId) {
      input.logger.debug?.(
        {
          label: input.commandLabel,
          target: metadata.targetService,
          expected: input.targetServiceId,
          command: metadata.commandName,
        },
        "shouldProcess: target mismatch — skipping",
      );
      return false;
    }
    if (typeof metadata.commandName !== "string" || typeof metadata.tenantId !== "string") {
      input.logger.debug?.(
        { label: input.commandLabel },
        "shouldProcess: missing commandName or tenantId",
      );
      return false;
    }
    input.logger.debug?.(
      { label: input.commandLabel, command: metadata.commandName, target: metadata.targetService },
      "shouldProcess: WILL PROCESS",
    );
    return metadata.commandName.length > 0 && metadata.tenantId.length > 0;
  };

  const processMessage = async (
    message: KafkaMessage,
    topic: string,
    partition: number,
    highWatermark?: string | null,
  ): Promise<void> => {
    const recordLag = (): void => {
      if (!input.metrics?.setConsumerLag || !highWatermark) {
        return;
      }

      try {
        const high = BigInt(highWatermark);
        const current = BigInt(message.offset);
        const rawLag = high - current - 1n;
        const lag = rawLag > 0n ? Number(rawLag) : 0;
        input.metrics.setConsumerLag(topic, partition, lag);
      } catch (error) {
        input.logger.warn(
          {
            err: error,
            topic,
            partition,
            offset: message.offset,
            highWatermark,
          },
          "Failed to compute command consumer lag",
        );
      }
    };

    if (!message.value) {
      input.logger.warn(
        { topic, partition, offset: message.offset },
        "skipping Kafka message with empty value",
      );
      recordLag();
      return;
    }

    const startedAt = performance.now();
    const rawValue = message.value.toString();
    const messageKey = message.key?.toString() ?? `offset-${message.offset}`;

    let envelope: CommandEnvelope;
    try {
      envelope = JSON.parse(rawValue) as CommandEnvelope;
    } catch (error) {
      input.logger.error(
        { err: error, topic, partition, offset: message.offset },
        "failed to parse command envelope; routing to DLQ",
      );
      input.metrics?.recordOutcome?.("unknown", "parse_error");
      input.metrics?.observeDuration?.("unknown", (performance.now() - startedAt) / 1000);
      try {
        await input.publishDlqEvent({
          key: messageKey,
          value: JSON.stringify(
            input.buildDlqPayload({
              rawValue,
              topic,
              partition,
              offset: message.offset,
              attempts: 1,
              failureReason: "PARSING_ERROR",
              error,
            }),
          ),
          headers: {
            "x-tartware-dlq": input.serviceName,
          },
        });
      } catch (dlqError) {
        input.logger.error(
          { err: dlqError, topic, partition, offset: message.offset },
          "CRITICAL: Failed to publish parse error to DLQ; message may be lost",
        );
      }
      recordLag();
      return;
    }

    const metadata = envelope.metadata;
    if (!shouldProcess(metadata)) {
      recordLag();
      return;
    }

    // Idempotency check - skip if command was already processed
    const idempotencyKey = metadata.idempotencyKey ?? metadata.commandId;
    if (idempotencyKey && input.checkIdempotency) {
      try {
        const isDuplicate = await input.checkIdempotency({
          tenantId: metadata.tenantId,
          idempotencyKey,
          commandName: metadata.commandName,
        });
        if (isDuplicate) {
          input.logger.info(
            {
              commandName: metadata.commandName,
              tenantId: metadata.tenantId,
              idempotencyKey,
              commandId: metadata.commandId,
            },
            `${input.commandLabel} command skipped (duplicate)`,
          );
          input.metrics?.recordOutcome?.(metadata.commandName, "duplicate");
          recordLag();
          return;
        }
      } catch (error) {
        if (idempotencyFailureMode === "fail-closed") {
          input.logger.error(
            { err: error, metadata, idempotencyKey },
            "Idempotency check failed; routing to DLQ",
          );
          input.metrics?.recordOutcome?.(metadata.commandName, "handler_error");
          input.metrics?.observeDuration?.(
            metadata.commandName,
            (performance.now() - startedAt) / 1000,
          );
          try {
            await input.publishDlqEvent({
              key: messageKey,
              value: JSON.stringify(
                input.buildDlqPayload({
                  envelope,
                  rawValue,
                  topic,
                  partition,
                  offset: message.offset,
                  attempts: 1,
                  failureReason: "HANDLER_FAILURE",
                  error,
                }),
              ),
              headers: {
                "x-tartware-dlq": input.serviceName,
                ...(metadata.tenantId && { "x-tenant-id": metadata.tenantId }),
              },
            });
          } catch (dlqError) {
            input.logger.error(
              {
                err: dlqError,
                metadata,
                topic,
                partition,
                offset: message.offset,
              },
              "CRITICAL: Failed to publish idempotency failure to DLQ; message may be lost",
            );
          }
          recordLag();
          return;
        }

        input.logger.warn(
          { err: error, metadata, idempotencyKey },
          "Idempotency check failed; proceeding with command processing",
        );
      }
    }

    try {
      const { attempts } = await input.processWithRetry(
        () => input.routeCommand(envelope, metadata),
        {
          maxRetries: input.retry.maxRetries,
          baseDelayMs: input.retry.baseDelayMs,
          delayScheduleMs: input.retry.delayScheduleMs,
          isRetryable: input.retry.isRetryable,
          onRetry: ({ attempt, delayMs, error }) => {
            input.logger.warn(
              { attempt, delayMs, err: error, metadata },
              `retrying ${input.commandLabel} command`,
            );
          },
        },
      );
      input.logger.info(
        {
          commandName: metadata.commandName,
          tenantId: metadata.tenantId,
          commandId: metadata.commandId,
          correlationId: metadata.correlationId,
          attempts,
          durationMs: performance.now() - startedAt,
        },
        `${input.commandLabel} command applied`,
      );
      input.metrics?.recordOutcome?.(metadata.commandName, "success");
      input.metrics?.observeDuration?.(
        metadata.commandName,
        (performance.now() - startedAt) / 1000,
      );

      // Record idempotency after successful processing. When the batch collector
      // is active the row is buffered and written with the rest of the batch,
      // which is also when the offsets are committed — so a crash replays
      // exactly the commands whose offsets were never committed.
      if (idempotencyKey && (input.recordIdempotency || pendingIdempotency)) {
        const row = {
          tenantId: metadata.tenantId,
          idempotencyKey,
          commandName: metadata.commandName,
          commandId: metadata.commandId,
          processedAt: new Date(),
        };
        if (pendingIdempotency) {
          pendingIdempotency.push(row);
        } else if (input.recordIdempotency) {
          try {
            await input.recordIdempotency(row);
          } catch (error) {
            input.logger.warn(
              { err: error, metadata, idempotencyKey },
              "Failed to record idempotency; command processed successfully",
            );
          }
        }
      }
    } catch (error) {
      const retryExhausted = error instanceof input.RetryExhaustedError;
      const attempts = retryExhausted ? error.attempts : 1;
      // Pino's built-in `err` serializer captures message+stack but NOT custom
      // properties (e.g. BillingCommandError.code). Emit them explicitly so
      // every DLQ entry is self-contained and diagnosable without source lookup.
      const errCode =
        error != null && typeof error === "object" && "code" in error
          ? (error as { code: unknown }).code
          : undefined;
      input.logger.error(
        {
          err: error,
          errMessage: error instanceof Error ? error.message : String(error),
          errCode,
          errStack: error instanceof Error ? error.stack : undefined,
          metadata,
          attempts,
          retried: retryExhausted,
        },
        retryExhausted
          ? `${input.commandLabel} command failed after ${attempts} attempts; routing to DLQ`
          : `${input.commandLabel} command failed (non-retryable); routing to DLQ`,
      );
      input.metrics?.recordOutcome?.(metadata.commandName, "handler_error");
      input.metrics?.observeDuration?.(
        metadata.commandName,
        (performance.now() - startedAt) / 1000,
      );
      try {
        await input.publishDlqEvent({
          key: messageKey,
          value: JSON.stringify(
            input.buildDlqPayload({
              envelope,
              rawValue,
              topic,
              partition,
              offset: message.offset,
              attempts,
              failureReason: "HANDLER_FAILURE",
              error,
            }),
          ),
          headers: {
            "x-tartware-dlq": input.serviceName,
            ...(metadata.tenantId && { "x-tenant-id": metadata.tenantId }),
          },
        });
      } catch (dlqError) {
        input.logger.error(
          {
            err: dlqError,
            metadata,
            attempts,
            topic,
            partition,
            offset: message.offset,
          },
          "CRITICAL: Failed to publish handler error to DLQ; message may be lost",
        );
      }
    }

    recordLag();
  };

  const handleBatch = async ({
    batch,
    resolveOffset,
    heartbeat,
    commitOffsetsIfNecessary,
    isRunning,
    isStale,
  }: EachBatchPayload): Promise<void> => {
    if (!isRunning() || isStale()) {
      return;
    }

    // Group by the message key, which is the aggregate the command mutates.
    // Two commands with different keys touch different reservations or folios
    // and cannot depend on each other, so their groups may overlap; commands
    // sharing a key stay strictly in order inside their own group.
    const groups = new Map<string, KafkaMessage[]>();
    for (const message of batch.messages) {
      // A message with no key has no aggregate to be ordered against, so it
      // gets a group of its own rather than serialising behind unrelated work.
      const key = message.key ? message.key.toString() : `__unkeyed:${message.offset}`;
      const existing = groups.get(key);
      if (existing) {
        existing.push(message);
      } else {
        groups.set(key, [message]);
      }
    }

    pendingIdempotency = input.recordIdempotencyBatch ? [] : null;

    // KafkaJS expects a heartbeat well inside the session timeout; a wide batch
    // can otherwise run long enough for the group to evict this member.
    let lastHeartbeat = Date.now();
    const beat = async (): Promise<void> => {
      if (Date.now() - lastHeartbeat < 1_000) {
        return;
      }
      lastHeartbeat = Date.now();
      await heartbeat();
    };

    await runWithConcurrency([...groups.values()], batchConcurrency, async (messages) => {
      for (const message of messages) {
        if (!isRunning() || isStale()) {
          return;
        }
        await processMessage(message, batch.topic, batch.partition, batch.highWatermark);
        await beat();
      }
    });

    if (input.recordIdempotencyBatch && pendingIdempotency && pendingIdempotency.length > 0) {
      try {
        await input.recordIdempotencyBatch(pendingIdempotency);
      } catch (error) {
        // The commands themselves succeeded; losing the record only risks them
        // being reprocessed, which their handlers already tolerate.
        input.logger.warn(
          { err: error, rows: pendingIdempotency.length },
          "Failed to record idempotency batch; commands processed successfully",
        );
      }
    }
    pendingIdempotency = null;

    // Offsets are resolved in the batch's own order once every group is done,
    // so a partial batch never marks a later offset complete than the earliest
    // message that still needs replaying.
    for (const message of batch.messages) {
      resolveOffset(message.offset);
    }
    await heartbeat();
    await commitOffsetsIfNecessary();
  };

  return { handleBatch };
};
