import { performance } from "node:perf_hooks";

import type { EachBatchPayload, KafkaMessage } from "kafkajs";

export type CommandEnvelope = {
  metadata?: {
    commandId?: string;
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
};

export const createCommandCenterHandlers = (
  input: CreateCommandCenterHandlersInput,
) => {
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
  ): Promise<void> => {
    if (!message.value) {
      input.logger.warn(
        { topic, partition, offset: message.offset },
        "skipping Kafka message with empty value",
      );
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
      return;
    }

    const metadata = envelope.metadata;
    if (!shouldProcess(metadata)) {
      return;
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
    } catch (error) {
      const attempts =
        error instanceof input.RetryExhaustedError ? error.attempts : 1;
      input.logger.error(
        { err: error, metadata, attempts },
        `${input.commandLabel} command failed after retries; routing to DLQ`,
      );
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
    }
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
      await processMessage(message, batch.topic, batch.partition);
      resolveOffset(message.offset);
      await heartbeat();
    }

    await commitOffsetsIfNecessary();
  };

  return { handleBatch };
};
