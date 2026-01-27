import { performance } from "node:perf_hooks";

import { createServiceLogger } from "@tartware/telemetry";
import type { Consumer, EachBatchPayload, KafkaMessage } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishDlqEvent } from "../kafka/producer.js";
import { processWithRetry, RetryExhaustedError } from "../lib/retry.js";
import {
  approveSettingsValue,
  bulkSetSettingsValues,
  revertSettingsValue,
  setSettingsValue,
} from "../services/settings-command-service.js";

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

const logger = createServiceLogger({
  serviceName: config.service.name,
  level: config.log.level,
  pretty: config.log.pretty,
  environment: process.env.NODE_ENV,
}).child({ module: "settings-command-consumer" });

export const startSettingsCommandCenterConsumer = async (): Promise<void> => {
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
    "settings command consumer started",
  );
};

export const shutdownSettingsCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("settings command consumer disconnected");
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
  if (metadata.targetService && metadata.targetService !== config.commandCenter.targetServiceId) {
    return false;
  }
  if (typeof metadata.commandName !== "string" || typeof metadata.tenantId !== "string") {
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
    const { attempts } = await processWithRetry(() => routeSettingsCommand(envelope, metadata), {
      maxRetries: config.commandCenter.maxRetries,
      baseDelayMs: config.commandCenter.retryBackoffMs,
      delayScheduleMs:
        config.commandCenter.retryScheduleMs.length > 0
          ? config.commandCenter.retryScheduleMs
          : undefined,
      onRetry: ({ attempt, delayMs, error }) => {
        logger.warn({ attempt, delayMs, err: error, metadata }, "retrying settings command");
      },
    });
    logger.info(
      {
        commandName: metadata.commandName,
        tenantId: metadata.tenantId,
        commandId: metadata.commandId,
        correlationId: metadata.correlationId,
        attempts,
        durationMs: performance.now() - startedAt,
      },
      "settings command applied",
    );
  } catch (error) {
    const attempts = error instanceof RetryExhaustedError ? error.attempts : 1;
    logger.error(
      { err: error, metadata, attempts },
      "settings command failed after retries; routing to DLQ",
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

const routeSettingsCommand = async (
  envelope: CommandEnvelope,
  metadata: NonNullable<CommandEnvelope["metadata"]> & {
    commandName: string;
    tenantId: string;
  },
): Promise<void> => {
  switch (metadata.commandName) {
    case "settings.value.set":
      await setSettingsValue(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "settings.value.bulk_set":
      await bulkSetSettingsValues(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "settings.value.approve":
      await approveSettingsValue(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "settings.value.revert":
      await revertSettingsValue(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no settings handler registered for command",
      );
  }
};
