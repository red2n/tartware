import type { Consumer } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { appLogger } from "../lib/logger.js";
import { GuestRegisterCommandSchema } from "../schemas/guest-commands.js";
import { registerGuestProfile } from "../services/guest-command-service.js";

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
    eachMessage: async ({ message, topic, partition }) => {
      if (!message.value) {
        return;
      }

      let envelope: CommandEnvelope;
      try {
        envelope = JSON.parse(message.value.toString()) as CommandEnvelope;
      } catch (error) {
        consumerLogger.error(
          { err: error, topic, partition },
          "failed to parse command envelope",
        );
        return;
      }

      const metadata = envelope.metadata ?? {};
      if (!shouldProcessCommand(metadata)) {
        return;
      }

      try {
        await routeCommand(envelope, metadata);
      } catch (error) {
        consumerLogger.error(
          {
            err: error,
            metadata,
          },
          "failed to process command from command center",
        );
      }
    },
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
