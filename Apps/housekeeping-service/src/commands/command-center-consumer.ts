import type { Consumer } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { appLogger } from "../lib/logger.js";
import {
  assignHousekeepingTask,
  completeHousekeepingTask,
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
      eachMessage: async ({ message, partition, topic }) => {
        if (!message.value) {
          return;
        }
        let envelope: CommandEnvelope;
        try {
          envelope = JSON.parse(message.value.toString()) as CommandEnvelope;
        } catch (error) {
          logger.error(
            { err: error, topic, partition },
            "failed to parse command envelope",
          );
          return;
        }

        const metadata = envelope.metadata;
        if (!shouldProcess(metadata)) {
          return;
        }

        try {
          await routeHousekeepingCommand(envelope, metadata);
          logger.info(
            {
              commandName: metadata.commandName,
              tenantId: metadata.tenantId,
              commandId: metadata.commandId,
              correlationId: metadata.correlationId,
            },
            "housekeeping command applied",
          );
        } catch (error) {
          logger.error({ err: error, metadata }, "housekeeping command failed");
        }
      },
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
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no housekeeping handler for command",
      );
  }
};
