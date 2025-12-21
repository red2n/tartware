import type { Consumer } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { appLogger } from "../lib/logger.js";
import { handleRoomInventoryCommand } from "../services/room-command-service.js";

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

const logger = appLogger.child({ module: "rooms-command-consumer" });

export const startRoomsCommandCenterConsumer = async (): Promise<void> => {
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
        await routeRoomCommand(envelope, metadata);
        logger.info(
          {
            commandName: metadata.commandName,
            tenantId: metadata.tenantId,
            commandId: metadata.commandId,
            correlationId: metadata.correlationId,
          },
          "room command applied",
        );
      } catch (error) {
        logger.error(
          { err: error, metadata },
          "room command processing failed",
        );
      }
    },
  });

  logger.info(
    {
      topic: config.commandCenter.topic,
      groupId: config.commandCenter.consumerGroupId,
      targetService: config.commandCenter.targetServiceId,
    },
    "rooms command consumer started",
  );
};

export const shutdownRoomsCommandCenterConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("rooms command consumer disconnected");
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

const routeRoomCommand = async (
  envelope: CommandEnvelope,
  metadata: NonNullable<CommandEnvelope["metadata"]> & {
    commandName: string;
    tenantId: string;
  },
): Promise<void> => {
  switch (metadata.commandName) {
    case "rooms.inventory.block":
      await handleRoomInventoryCommand(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug(
        {
          commandName: metadata.commandName,
        },
        "no command handler registered for rooms service",
      );
  }
};
