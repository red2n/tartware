/**
 * Consumer lifecycle factory — eliminates repeated start/shutdown boilerplate
 * across all command-center consumer files.
 */

import { processWithRetry, RetryExhaustedError } from "@tartware/config/retry";
import type { Consumer, Kafka } from "kafkajs";
import { CommandError } from "./command-utils.js";
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
  /**
   * How many assigned partitions this process drains at once.
   *
   * Commands within a partition stay strictly ordered whatever this is set to;
   * raising it only lets *different* partitions make progress while one waits
   * on its database round trips. Left at 1, a consumer's ceiling is a single
   * command's latency — roughly 200/sec against a 5 ms handler, no matter how
   * many partitions it owns or how many replicas are running.
   */
  partitionsConsumedConcurrently: number;
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
  /**
   * Predicate deciding whether a caught error is worth retrying. Defaults to
   * {@link isRetryableByDefault}, which honours `CommandError.retryable` —
   * override only for a failure mode that contract cannot express.
   */
  isRetryable?: (error: unknown) => boolean;
  /**
   * Called before routing a command — wire `enterTenantScope` here for RLS.
   *
   * @deprecated Prefer {@link CreateConsumerLifecycleInput.withTenantScope}. This
   * sets ambient scope that outlives the command and is unsafe once
   * `partitionsConsumedConcurrently` exceeds 1.
   */
  onTenantResolved?: (tenantId: string) => void;
  /**
   * Runs a command inside its RLS tenant scope — wire `runWithTenantScope` here.
   *
   * Preferred over {@link CreateConsumerLifecycleInput.onTenantResolved}: the
   * scope covers exactly one command instead of leaking into the batch runner,
   * which is what makes concurrent partition consumption safe.
   */
  withTenantScope?: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
};

/**
 * Default retry policy: retry an unrecognised failure, but never a
 * {@link CommandError} that declares itself non-retryable.
 *
 * The underlying `processWithRetry` retries everything unless told otherwise,
 * which is the wrong default here. Commands are consumed in partition order, so
 * retrying a deterministic rejection — wrong status, missing FK, failed
 * validation — burns the whole backoff ladder, stalls every command queued
 * behind it, and still routes to the DLQ at the end of it.
 *
 * Applied by {@link createConsumerLifecycle} unless a consumer passes its own,
 * so a new consumer gets the safe behaviour without having to know about it.
 */
export const isRetryableByDefault = (error: unknown): boolean =>
  !(error instanceof CommandError) || error.retryable;

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

    // Wrap routeCommand so each command runs inside its own RLS tenant scope.
    // `withTenantScope` confines the scope to the command; `onTenantResolved`
    // is the older ambient form, kept for consumers that still pass it.
    const wrappedRouteCommand: typeof input.routeCommand = async (envelope, metadata) => {
      const route = () => input.routeCommand(envelope, metadata);
      if (input.withTenantScope) {
        return input.withTenantScope(metadata.tenantId, route);
      }
      input.onTenantResolved?.(metadata.tenantId);
      return route();
    };

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
        isRetryable: input.isRetryable ?? isRetryableByDefault,
      },
      processWithRetry,
      RetryExhaustedError,
      publishDlqEvent: input.publishDlqEvent,
      buildDlqPayload,
      routeCommand: wrappedRouteCommand,
      commandLabel: input.commandLabel,
      metrics: input.metrics,
      ...(input.checkIdempotency && {
        checkIdempotency: input.checkIdempotency,
        recordIdempotency: input.recordIdempotency,
        idempotencyFailureMode: input.idempotencyFailureMode,
      }),
    });

    // Concurrency is only safe when the tenant scope is confined to a single
    // command. With the ambient `onTenantResolved` form, interleaved partitions
    // would leave one tenant's scope visible to another's queries, so hold the
    // consumer at 1 and say why rather than risking a cross-tenant read.
    let concurrency = Math.max(1, input.commandCenterConfig.partitionsConsumedConcurrently);
    if (concurrency > 1 && input.onTenantResolved && !input.withTenantScope) {
      input.logger.warn(
        { requested: concurrency, serviceName: input.serviceName },
        `${input.commandLabel} consumer pinned to 1 partition: partitionsConsumedConcurrently > 1 requires withTenantScope (runWithTenantScope), not onTenantResolved`,
      );
      concurrency = 1;
    }

    await consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      partitionsConsumedConcurrently: concurrency,
      eachBatch: handleBatch,
    });

    input.logger.info(
      {
        topic: input.commandCenterConfig.topic,
        groupId: input.commandCenterConfig.consumerGroupId,
        targetService: input.commandCenterConfig.targetServiceId,
        partitionsConsumedConcurrently: concurrency,
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
