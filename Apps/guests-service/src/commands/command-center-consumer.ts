import { performance } from "node:perf_hooks";

import type { Consumer, EachBatchPayload, KafkaMessage } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishDlqEvent } from "../kafka/producer.js";
import { appLogger } from "../lib/logger.js";
import { processWithRetry, RetryExhaustedError } from "../lib/retry.js";
import { GuestRegisterCommandSchema } from "../schemas/guest-commands.js";
import {
  eraseGuestForGdpr,
  mergeGuestProfiles,
  registerGuestProfile,
  setGuestBlacklist,
  setGuestLoyalty,
  setGuestVip,
  updateGuestContact,
  updateGuestPreferences,
  updateGuestProfile,
} from "../services/guest-command-service.js";

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

const consumerLogger = appLogger.child({
  module: "guests-command-center-consumer",
});

let consumer: Consumer | null = null;

export const startGuestsCommandCenterConsumer = async (): Promise<void> => {
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

  consumerLogger.info(
    {
      topic: config.commandCenter.topic,
      groupId: config.commandCenter.consumerGroupId,
      targetService: config.commandCenter.targetServiceId,
    },
    "guests command consumer connected",
  );
};

export const shutdownGuestsCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    consumerLogger.info("guests command consumer disconnected");
  } finally {
    consumer = null;
  }
};

const shouldProcessCommand = (
  metadata: NonNullable<CommandEnvelope["metadata"]>,
): metadata is NonNullable<CommandEnvelope["metadata"]> & {
  commandName: string;
  tenantId: string;
} => {
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

  try {
    for (const message of batch.messages) {
      if (!isRunning() || isStale()) {
        break;
      }
      await processMessage(message, batch.topic, batch.partition);
      resolveOffset(message.offset);
      await heartbeat();
    }
  } finally {
    await commitOffsetsIfNecessary();
  }
};

const processMessage = async (
  message: KafkaMessage,
  topic: string,
  partition: number,
): Promise<void> => {
  if (!message.value) {
    consumerLogger.warn(
      { topic, partition, offset: message.offset },
      "skipping Kafka message with empty value",
    );
    return;
  }

  let envelope: CommandEnvelope;
  try {
    envelope = JSON.parse(message.value.toString()) as CommandEnvelope;
  } catch (error) {
    consumerLogger.error(
      { err: error, topic, partition, offset: message.offset },
      "failed to parse command envelope; routing to DLQ",
    );
    await publishDlqEvent({
      key: message.key?.toString() ?? `offset-${message.offset}`,
      value: JSON.stringify(
        buildDlqPayload({
          rawValue: message.value.toString(),
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

  const metadata = envelope.metadata ?? {};
  if (!shouldProcessCommand(metadata)) {
    return;
  }

  try {
    const startedAt = performance.now();
    const { attempts } = await processWithRetry(
      () => routeCommand(envelope, metadata),
      {
        maxRetries: config.commandCenter.maxRetries,
        baseDelayMs: config.commandCenter.retryBackoffMs,
        delayScheduleMs:
          config.commandCenter.retryScheduleMs.length > 0
            ? config.commandCenter.retryScheduleMs
            : undefined,
        onRetry: ({ attempt, delayMs, error }) => {
          consumerLogger.warn(
            { attempt, delayMs, err: error, metadata },
            "retrying guest command",
          );
        },
      },
    );
    consumerLogger.info(
      {
        commandName: metadata.commandName,
        tenantId: metadata.tenantId,
        commandId: metadata.commandId,
        correlationId: metadata.correlationId,
        attempts,
        durationMs: performance.now() - startedAt,
      },
      "guest command applied",
    );
  } catch (error) {
    const attempts = error instanceof RetryExhaustedError ? error.attempts : 1;
    consumerLogger.error(
      {
        err: error,
        metadata,
        topic,
        partition,
        offset: message.offset,
      },
      "guest command failed after retries; routing to DLQ",
    );
    await publishDlqEvent({
      key: message.key?.toString() ?? `offset-${message.offset}`,
      value: JSON.stringify(
        buildDlqPayload({
          envelope,
          rawValue: message.value.toString(),
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

const routeCommand = async (
  envelope: CommandEnvelope,
  metadata: NonNullable<CommandEnvelope["metadata"]> & {
    commandName: string;
    tenantId: string;
  },
): Promise<void> => {
  switch (metadata.commandName) {
    case "guest.register":
      await handleGuestRegisterCommand(envelope.payload, metadata);
      break;
    case "guest.merge":
      await mergeGuestProfiles({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "guest.update_profile":
      await updateGuestProfile({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "guest.update_contact":
      await updateGuestContact({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "guest.set_loyalty":
      await setGuestLoyalty({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "guest.set_vip":
      await setGuestVip({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "guest.set_blacklist":
      await setGuestBlacklist({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "guest.gdpr.erase":
      await eraseGuestForGdpr({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "guest.preference.update":
      await updateGuestPreferences({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    default:
      consumerLogger.debug(
        {
          commandName: metadata.commandName,
        },
        "no handler defined for command",
      );
  }
};

const handleGuestRegisterCommand = async (
  payload: unknown,
  metadata: NonNullable<CommandEnvelope["metadata"]>,
): Promise<void> => {
  const parsedPayload = GuestRegisterCommandSchema.parse(payload);
  await registerGuestProfile({
    tenantId: metadata.tenantId as string,
    payload: parsedPayload,
    correlationId: metadata.correlationId ?? metadata.requestId,
    initiatedBy: metadata.initiatedBy ?? null,
  });
};
