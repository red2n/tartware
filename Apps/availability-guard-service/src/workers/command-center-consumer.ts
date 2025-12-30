import type { FastifyBaseLogger } from "fastify";
import type { Consumer, KafkaMessage } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../lib/kafka.js";
import {
  lockRoom,
  releaseLock,
  releaseLocksInBulk,
} from "../services/lock-service.js";
import {
  type BulkReleaseInput,
  bulkReleaseSchema,
  type LockRoomInput,
  lockRoomSchema,
  type ReleaseLockInput,
  releaseLockSchema,
} from "../types/lock-types.js";

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

type CommandMetadata = NonNullable<CommandEnvelope["metadata"]> & {
  commandName: string;
  tenantId: string;
};

type UnknownRecord = Record<string, unknown>;

let consumer: Consumer | null = null;
let runLoop: Promise<void> | null = null;

export const startAvailabilityGuardCommandCenterConsumer = async (
  logger: FastifyBaseLogger,
): Promise<void> => {
  if (consumer) {
    logger.warn(
      { module: "availability-guard-command-consumer" },
      "Availability Guard command consumer already running",
    );
    return;
  }

  const workerLogger = logger.child({
    module: "availability-guard-command-consumer",
  });

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

  runLoop = consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      await processMessage(message, topic, partition, workerLogger);
    },
  });

  runLoop.catch((error: unknown) => {
    workerLogger.error(
      { err: error },
      "Availability Guard command consumer crashed",
    );
  });

  workerLogger.info(
    {
      topic: config.commandCenter.topic,
      groupId: config.commandCenter.consumerGroupId,
      targetService: config.commandCenter.targetServiceId,
    },
    "Availability Guard command consumer started",
  );
};

export const shutdownAvailabilityGuardCommandCenterConsumer = async (
  logger: FastifyBaseLogger,
): Promise<void> => {
  if (!consumer) {
    return;
  }

  const workerLogger = logger.child({
    module: "availability-guard-command-consumer",
  });

  try {
    await consumer.stop();
    await runLoop?.catch(() => undefined);
    await consumer.disconnect();
    workerLogger.info("Availability Guard command consumer stopped");
  } catch (error) {
    workerLogger.error(
      { err: error },
      "Failed to shutdown Availability Guard command consumer",
    );
  } finally {
    consumer = null;
    runLoop = null;
  }
};

const processMessage = async (
  message: KafkaMessage,
  topic: string,
  partition: number,
  logger: FastifyBaseLogger,
): Promise<void> => {
  if (!message.value) {
    logger.warn(
      { topic, partition, offset: message.offset },
      "Skipping command with empty payload",
    );
    return;
  }

  let envelope: CommandEnvelope;
  try {
    envelope = JSON.parse(message.value.toString("utf-8")) as CommandEnvelope;
  } catch (error) {
    logger.error(
      { err: error, topic, partition },
      "Failed to parse command envelope",
    );
    return;
  }

  const metadata = envelope.metadata;
  if (!shouldProcessCommand(metadata)) {
    return;
  }

  try {
    await routeCommand(envelope.payload, metadata, logger);
  } catch (error) {
    logger.error(
      {
        err: error,
        commandName: metadata.commandName,
        tenantId: metadata.tenantId,
        topic,
        partition,
        offset: message.offset,
      },
      "Command processing failed",
    );
    // Skip error and continue - consistent with parse errors and filtered commands
  }
};

const routeCommand = async (
  payload: unknown,
  metadata: CommandMetadata,
  logger: FastifyBaseLogger,
): Promise<void> => {
  switch (metadata.commandName) {
    case "inventory.lock.room":
      await handleLockRoomCommand(payload, metadata, logger);
      return;
    case "inventory.release.room":
      await handleReleaseRoomCommand(payload, metadata, logger);
      return;
    case "inventory.release.bulk":
      await handleBulkReleaseCommand(payload, metadata, logger);
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "No handler registered for command",
      );
  }
};

const handleLockRoomCommand = async (
  payload: unknown,
  metadata: CommandMetadata,
  logger: FastifyBaseLogger,
): Promise<void> => {
  const parsed = parseLockPayload(payload, metadata, logger);
  if (!parsed) {
    return;
  }

  const result = await lockRoom({
    ...parsed,
    metadata: enrichCommandMetadata(parsed.metadata, metadata),
  });

  if (result.status === "LOCKED") {
    logger.info(
      {
        commandName: metadata.commandName,
        commandId: metadata.commandId,
        tenantId: parsed.tenantId,
        reservationId: parsed.reservationId,
        lockId: result.lock.id,
      },
      "Inventory lock applied via command",
    );
    return;
  }

  logger.warn(
    {
      commandName: metadata.commandName,
      commandId: metadata.commandId,
      tenantId: parsed.tenantId,
      reservationId: parsed.reservationId,
    },
    "Inventory lock command resulted in conflict",
  );
};

const handleReleaseRoomCommand = async (
  payload: unknown,
  metadata: CommandMetadata,
  logger: FastifyBaseLogger,
): Promise<void> => {
  const parsed = parseReleasePayload(payload, metadata, logger);
  if (!parsed) {
    return;
  }

  const released = await releaseLock({
    ...parsed,
    metadata: enrichCommandMetadata(parsed.metadata, metadata),
  });

  if (!released) {
    logger.warn(
      {
        commandName: metadata.commandName,
        commandId: metadata.commandId,
        tenantId: parsed.tenantId,
        lockId: parsed.lockId,
      },
      "Release command had no matching lock",
    );
    return;
  }

  logger.info(
    {
      commandName: metadata.commandName,
      commandId: metadata.commandId,
      tenantId: parsed.tenantId,
      lockId: released.id,
    },
    "Inventory lock released via command",
  );
};

const handleBulkReleaseCommand = async (
  payload: unknown,
  metadata: CommandMetadata,
  logger: FastifyBaseLogger,
): Promise<void> => {
  const parsed = parseBulkReleasePayload(payload, metadata, logger);
  if (!parsed) {
    return;
  }

  const released = await releaseLocksInBulk(parsed);

  logger.info(
    {
      commandName: metadata.commandName,
      commandId: metadata.commandId,
      tenantId: parsed.tenantId,
      released,
    },
    "Bulk inventory release command applied",
  );
};

const shouldProcessCommand = (
  metadata: CommandEnvelope["metadata"],
): metadata is CommandMetadata => {
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
    !isNonEmptyString(metadata.commandName) ||
    !isNonEmptyString(metadata.tenantId)
  ) {
    return false;
  }

  return true;
};

const parseLockPayload = (
  payload: unknown,
  metadata: CommandMetadata,
  logger: FastifyBaseLogger,
): LockRoomInput | null => {
  try {
    return lockRoomSchema.parse(
      withCommandDefaults(payload, metadata, {
        includeMetadata: true,
      }),
    );
  } catch (error) {
    logger.error(
      { err: error, commandName: metadata.commandName },
      "Invalid inventory.lock.room payload",
    );
    return null;
  }
};

const parseReleasePayload = (
  payload: unknown,
  metadata: CommandMetadata,
  logger: FastifyBaseLogger,
): ReleaseLockInput | null => {
  try {
    return releaseLockSchema.parse(
      withCommandDefaults(payload, metadata, {
        includeMetadata: true,
      }),
    );
  } catch (error) {
    logger.error(
      { err: error, commandName: metadata.commandName },
      "Invalid inventory.release.room payload",
    );
    return null;
  }
};

const parseBulkReleasePayload = (
  payload: unknown,
  metadata: CommandMetadata,
  logger: FastifyBaseLogger,
): BulkReleaseInput | null => {
  try {
    return bulkReleaseSchema.parse(
      withCommandDefaults(payload, metadata, {
        includeMetadata: false,
      }),
    );
  } catch (error) {
    logger.error(
      { err: error, commandName: metadata.commandName },
      "Invalid inventory.release.bulk payload",
    );
    return null;
  }
};

const withCommandDefaults = (
  payload: unknown,
  metadata: CommandMetadata,
  options: { includeMetadata: boolean },
): UnknownRecord => {
  const base = toRecord(payload);
  const normalized: UnknownRecord = { ...base };

  if (!isNonEmptyString(base.tenantId)) {
    normalized.tenantId = metadata.tenantId;
  }

  const correlationFallback =
    metadata.correlationId ?? metadata.requestId ?? metadata.commandId;
  if (!isNonEmptyString(base.correlationId) && correlationFallback) {
    normalized.correlationId = correlationFallback;
  }

  if (options.includeMetadata && !isRecord(base.metadata)) {
    delete normalized.metadata;
  }

  return normalized;
};

const enrichCommandMetadata = (
  existing: UnknownRecord | undefined,
  metadata: CommandMetadata,
): UnknownRecord | undefined => {
  const base = isRecord(existing) ? { ...existing } : {};

  if (!isNonEmptyString(base.source)) {
    base.source = "command-center";
  }

  if (metadata.commandId && base.commandId === undefined) {
    base.commandId = metadata.commandId;
  }
  if (metadata.commandName && base.commandName === undefined) {
    base.commandName = metadata.commandName;
  }
  if (metadata.targetService && base.targetService === undefined) {
    base.targetService = metadata.targetService;
  }
  if (metadata.initiatedBy && base.initiatedBy === undefined) {
    base.initiatedBy = metadata.initiatedBy;
  }

  if (!isNonEmptyString(base.correlationId)) {
    const correlation = metadata.correlationId ?? metadata.requestId;
    if (correlation) {
      base.correlationId = correlation;
    }
  }

  return Object.keys(base).length > 0 ? base : undefined;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toRecord = (value: unknown): UnknownRecord =>
  isRecord(value) ? value : {};
