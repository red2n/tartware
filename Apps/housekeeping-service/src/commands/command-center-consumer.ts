import { performance } from "node:perf_hooks";

import type { Consumer, EachBatchPayload, KafkaMessage } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishDlqEvent } from "../kafka/producer.js";
import { appLogger } from "../lib/logger.js";
import { processWithRetry, RetryExhaustedError } from "../lib/retry.js";
import {
  addHousekeepingTaskNote,
  assignHousekeepingTask,
  bulkUpdateHousekeepingStatus,
  completeHousekeepingTask,
  createHousekeepingTask,
  reassignHousekeepingTask,
  reopenHousekeepingTask,
} from "../services/housekeeping-command-service.js";

type CommandEnvelope = {
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

let consumer: Consumer | null = null;
const logger = appLogger.child({ module: "housekeeping-command-consumer" });

export const startHousekeepingCommandCenterConsumer =
  async (): Promise<void> => {
    if (consumer) {
      return;
    }

    consumer = kafka.consumer({
      groupId: config.commandCenter.consumerGroupId,
      allowAutoTopicCreation: false,
      maxBytesPerPartition: config.commandCenter.maxBatchBytes,
    });

    await consumer.connect();
    await consumer.subscribe({
      topic: config.commandCenter.topic,
      fromBeginning: false,
    });

    await consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: handleBatch,
    });

    logger.info(
      {
        topic: config.commandCenter.topic,
        groupId: config.commandCenter.consumerGroupId,
        targetService: config.commandCenter.targetServiceId,
      },
      "housekeeping command consumer started",
    );
  };

export const shutdownHousekeepingCommandCenterConsumer =
  async (): Promise<void> => {
    if (!consumer) {
      return;
    }
    try {
      await consumer.disconnect();
      logger.info("housekeeping command consumer disconnected");
    } finally {
      consumer = null;
    }
  };

const shouldProcess = (
  metadata: CommandEnvelope["metadata"],
): metadata is NonNullable<CommandEnvelope["metadata"]> & {
  commandName: string;
  tenantId: string;
} => {
  if (!metadata) {
    return false;
  }
  if (
    metadata.targetService &&
    metadata.targetService !== config.commandCenter.targetServiceId
  ) {
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

const processMessage = async (
  message: KafkaMessage,
  topic: string,
  partition: number,
): Promise<void> => {
  if (!message.value) {
    logger.warn(
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
    logger.error(
      { err: error, topic, partition, offset: message.offset },
      "failed to parse command envelope; routing to DLQ",
    );
    await publishDlqEvent({
      key: messageKey,
      value: JSON.stringify(
        buildDlqPayload({
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
        "x-tartware-dlq": config.service.name,
      },
    });
    return;
  }

  const metadata = envelope.metadata;
  if (!shouldProcess(metadata)) {
    return;
  }

  try {
    const { attempts } = await processWithRetry(
      () => routeHousekeepingCommand(envelope, metadata),
      {
        maxRetries: config.commandCenter.maxRetries,
        baseDelayMs: config.commandCenter.retryBackoffMs,
        delayScheduleMs:
          config.commandCenter.retryScheduleMs.length > 0
            ? config.commandCenter.retryScheduleMs
            : undefined,
        onRetry: ({ attempt, delayMs, error }) => {
          logger.warn(
            { attempt, delayMs, err: error, metadata },
            "retrying housekeeping command",
          );
        },
      },
    );
    logger.info(
      {
        commandName: metadata.commandName,
        tenantId: metadata.tenantId,
        commandId: metadata.commandId,
        correlationId: metadata.correlationId,
        attempts,
        durationMs: performance.now() - startedAt,
      },
      "housekeeping command applied",
    );
  } catch (error) {
    const attempts = error instanceof RetryExhaustedError ? error.attempts : 1;
    logger.error(
      { err: error, metadata, attempts },
      "housekeeping command failed after retries; routing to DLQ",
    );
    await publishDlqEvent({
      key: messageKey,
      value: JSON.stringify(
        buildDlqPayload({
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
        "x-tartware-dlq": config.service.name,
      },
    });
  }
};

const buildDlqPayload = (input: {
  envelope?: CommandEnvelope;
  rawValue: string;
  topic: string;
  partition: number;
  offset: string;
  attempts: number;
  failureReason: "PARSING_ERROR" | "HANDLER_FAILURE";
  error: unknown;
}) => {
  const error =
    input.error instanceof Error
      ? { name: input.error.name, message: input.error.message }
      : { name: "Error", message: String(input.error) };

  return {
    metadata: {
      failureReason: input.failureReason,
      attempts: input.attempts,
      topic: input.topic,
      partition: input.partition,
      offset: input.offset,
      commandId: input.envelope?.metadata?.commandId,
      commandName: input.envelope?.metadata?.commandName,
      tenantId: input.envelope?.metadata?.tenantId,
      requestId: input.envelope?.metadata?.requestId,
      targetService: input.envelope?.metadata?.targetService,
    },
    error,
    payload: input.envelope?.payload ?? null,
    raw: input.rawValue,
    emittedAt: new Date().toISOString(),
  };
};

const routeHousekeepingCommand = async (
  envelope: CommandEnvelope,
  metadata: NonNullable<CommandEnvelope["metadata"]> & {
    commandName: string;
    tenantId: string;
  },
): Promise<void> => {
  switch (metadata.commandName) {
    case "housekeeping.task.assign":
      await assignHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.complete":
      await completeHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.create":
      await createHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.reassign":
      await reassignHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.reopen":
      await reopenHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.add_note":
      await addHousekeepingTaskNote(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.bulk_status":
      await bulkUpdateHousekeepingStatus(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no housekeeping handler for command",
      );
  }
};
