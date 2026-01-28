import { performance } from "node:perf_hooks";

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
  };
  processWithRetry: ProcessWithRetry;
  RetryExhaustedError: new (...args: never[]) => Error & { attempts: number };
  publishDlqEvent: PublishDlqEvent;
  buildDlqPayload: BuildDlqPayload;
  routeCommand: (
    envelope: CommandEnvelope,
    metadata: CommandMetadata,
  ) => Promise<void>;
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
};

export const createCommandCenterHandlers = (
  input: CreateCommandCenterHandlersInput,
) => {
  // Validate idempotency callbacks are properly paired
  const hasCheck = typeof input.checkIdempotency === "function";
  const hasRecord = typeof input.recordIdempotency === "function";
  if (hasCheck !== hasRecord) {
    throw new Error(
      "checkIdempotency and recordIdempotency must both be provided or both omitted",
    );
  }

  const idempotencyFailureMode = input.idempotencyFailureMode ?? "fail-open";

  const shouldProcess = (
    metadata: CommandEnvelope["metadata"],
  ): metadata is CommandMetadata => {
    if (!metadata) {
      return false;
    }
    if (metadata.targetService && metadata.targetService !== input.targetServiceId) {
      return false;
    }
    if (
      typeof metadata.commandName !== "string" ||
      typeof metadata.tenantId !== "string"
    ) {
      return false;
    }
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
          { err: error, topic, partition, offset: message.offset, highWatermark },
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
      input.metrics?.observeDuration?.(
        "unknown",
        (performance.now() - startedAt) / 1000,
      );
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
              },
            });
          } catch (dlqError) {
            input.logger.error(
              { err: dlqError, metadata, topic, partition, offset: message.offset },
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

      // Record idempotency after successful processing
      if (idempotencyKey && input.recordIdempotency) {
        try {
          await input.recordIdempotency({
            tenantId: metadata.tenantId,
            idempotencyKey,
            commandName: metadata.commandName,
            commandId: metadata.commandId,
            processedAt: new Date(),
          });
        } catch (error) {
          input.logger.warn(
            { err: error, metadata, idempotencyKey },
            "Failed to record idempotency; command processed successfully",
          );
        }
      }
    } catch (error) {
      const attempts =
        error instanceof input.RetryExhaustedError ? error.attempts : 1;
      input.logger.error(
        { err: error, metadata, attempts },
        `${input.commandLabel} command failed after retries; routing to DLQ`,
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
          },
        });
      } catch (dlqError) {
        input.logger.error(
          { err: dlqError, metadata, attempts, topic, partition, offset: message.offset },
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

    for (const message of batch.messages) {
      if (!isRunning() || isStale()) {
        break;
      }
      await processMessage(
        message,
        batch.topic,
        batch.partition,
        batch.highWatermark,
      );
      resolveOffset(message.offset);
      await heartbeat();
    }

    await commitOffsetsIfNecessary();
  };

  return { handleBatch };
};
