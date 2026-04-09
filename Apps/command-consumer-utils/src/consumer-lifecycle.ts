/**
 * Consumer lifecycle factory — eliminates repeated start/shutdown boilerplate
 * across all command-center consumer files.
 */

import { processWithRetry, RetryExhaustedError } from "@tartware/config/retry";
import type { Consumer, Kafka } from "kafkajs";
import { buildDlqPayload } from "./dlq.js";
import {
  type CommandEnvelope,
  type CommandMetadata,
  createCommandCenterHandlers,
} from "./index.js";

type LoggerLike = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  debug?: (obj: unknown, msg?: string) => void;
  child?: (bindings: Record<string, unknown>) => LoggerLike;
};

type CommandCenterConfig = {
  topic: string;
  consumerGroupId: string;
  targetServiceId: string;
  maxBatchBytes: number;
  dlqTopic: string;
  maxRetries: number;
  retryBackoffMs: number;
  retryScheduleMs: number[];
};

type CommandConsumerMetrics = {
  recordOutcome?: (
    commandName: string,
    status: "success" | "parse_error" | "handler_error" | "duplicate",
  ) => void;
  observeDuration?: (commandName: string, durationSeconds: number) => void;
  setConsumerLag?: (topic: string, partition: number, lag: number) => void;
};

export type CreateConsumerLifecycleInput = {
  kafka: Kafka;
  commandCenterConfig: CommandCenterConfig;
  serviceName: string;
  commandLabel: string;
  logger: LoggerLike;
  routeCommand: (envelope: CommandEnvelope, metadata: CommandMetadata) => Promise<void>;
  publishDlqEvent: (input: {
    key: string;
    value: string;
    headers?: Record<string, string>;
  }) => Promise<unknown>;
  metrics?: CommandConsumerMetrics;
  checkIdempotency?: (input: {
    tenantId: string;
    idempotencyKey: string;
    commandName: string;
  }) => Promise<boolean>;
  recordIdempotency?: (input: {
    tenantId: string;
    idempotencyKey: string;
    commandName: string;
    commandId?: string;
    processedAt: Date;
  }) => Promise<void>;
  idempotencyFailureMode?: "fail-open" | "fail-closed";
  /** Predicate to decide if a caught error should be retried. */
  isRetryable?: (error: unknown) => boolean;
};

/**
 * Creates start/shutdown functions for a command-center Kafka consumer.
 * Encapsulates the connect → subscribe → run lifecycle and the
 * createCommandCenterHandlers wiring.
 */
export function createConsumerLifecycle(input: CreateConsumerLifecycleInput) {
  let consumer: Consumer | null = null;

  const start = async (): Promise<void> => {
    if (consumer) return;

    consumer = input.kafka.consumer({
      groupId: input.commandCenterConfig.consumerGroupId,
      allowAutoTopicCreation: false,
      maxBytesPerPartition: input.commandCenterConfig.maxBatchBytes,
    });

    await consumer.connect();
    await consumer.subscribe({
      topic: input.commandCenterConfig.topic,
      fromBeginning: false,
    });

    const { handleBatch } = createCommandCenterHandlers({
      targetServiceId: input.commandCenterConfig.targetServiceId,
      serviceName: input.serviceName,
      logger: input.logger,
      retry: {
        maxRetries: input.commandCenterConfig.maxRetries,
        baseDelayMs: input.commandCenterConfig.retryBackoffMs,
        delayScheduleMs:
          input.commandCenterConfig.retryScheduleMs.length > 0
            ? input.commandCenterConfig.retryScheduleMs
            : undefined,
        isRetryable: input.isRetryable,
      },
      processWithRetry,
      RetryExhaustedError,
      publishDlqEvent: input.publishDlqEvent,
      buildDlqPayload,
      routeCommand: input.routeCommand,
      commandLabel: input.commandLabel,
      metrics: input.metrics,
      ...(input.checkIdempotency && {
        checkIdempotency: input.checkIdempotency,
        recordIdempotency: input.recordIdempotency,
        idempotencyFailureMode: input.idempotencyFailureMode,
      }),
    });

    await consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: handleBatch,
    });

    input.logger.info(
      {
        topic: input.commandCenterConfig.topic,
        groupId: input.commandCenterConfig.consumerGroupId,
        targetService: input.commandCenterConfig.targetServiceId,
      },
      `${input.commandLabel} command consumer started`,
    );
  };

  const shutdown = async (): Promise<void> => {
    if (!consumer) return;
    try {
      await consumer.disconnect();
      input.logger.info(`${input.commandLabel} command consumer disconnected`);
    } finally {
      consumer = null;
    }
  };

  return { start, shutdown };
}
