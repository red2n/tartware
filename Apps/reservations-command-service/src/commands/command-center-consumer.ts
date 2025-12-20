import type { Consumer } from "kafkajs";

import { commandCenterConfig, kafkaConfig, serviceConfig } from "../config.js";
import { kafka } from "../kafka/client.js";
import { reservationsLogger } from "../logger.js";
import { ReservationCreateCommandSchema } from "../schemas/reservation-command.js";
import { createReservation } from "../services/reservation-command-service.js";

type CommandEnvelope = {
  metadata?: {
    commandName?: string;
    tenantId?: string;
    targetService?: string | null;
    correlationId?: string;
    requestId?: string;
  };
  payload?: unknown;
};

let commandConsumer: Consumer | null = null;

export const startCommandCenterConsumer = async (): Promise<void> => {
  if (commandConsumer) {
    return;
  }

  commandConsumer = kafka.consumer({
    groupId: commandCenterConfig.consumerGroupId,
    allowAutoTopicCreation: false,
    maxBytesPerPartition: kafkaConfig.maxBatchBytes,
  });

  await commandConsumer.connect();
  await commandConsumer.subscribe({
    topic: commandCenterConfig.topic,
    fromBeginning: false,
  });

  await commandConsumer.run({
    eachMessage: async ({ message, topic, partition }) => {
      if (!message.value) {
        return;
      }

      const rawValue = message.value.toString();

      let envelope: CommandEnvelope;
      try {
        envelope = JSON.parse(rawValue) as CommandEnvelope;
      } catch (error) {
        reservationsLogger.error(
          { err: error, topic, partition },
          "Failed to parse command envelope",
        );
        return;
      }

      const metadata = envelope.metadata ?? {};
      if (
        metadata.targetService &&
        metadata.targetService !== commandCenterConfig.targetServiceId
      ) {
        return;
      }

      if (!metadata.commandName || !metadata.tenantId) {
        reservationsLogger.warn(
          { metadata },
          "Command missing commandName or tenantId; skipping",
        );
        return;
      }

      if (metadata.commandName === "reservation.create") {
        await handleReservationCreateCommand(envelope, metadata).catch(
          (error) => {
            reservationsLogger.error(
              { err: error, metadata },
              "Failed to process reservation.create command",
            );
          },
        );
      }
    },
  });
};

export const shutdownCommandCenterConsumer = async (): Promise<void> => {
  if (commandConsumer) {
    await commandConsumer.disconnect();
    commandConsumer = null;
  }
};

const handleReservationCreateCommand = async (
  envelope: CommandEnvelope,
  metadata: NonNullable<CommandEnvelope["metadata"]>,
): Promise<void> => {
  const tenantId = metadata.tenantId;
  const commandPayload = ReservationCreateCommandSchema.parse(envelope.payload);

  await createReservation(tenantId as string, commandPayload, {
    correlationId: metadata.correlationId ?? metadata.requestId,
  });

  reservationsLogger.info(
    {
      commandName: metadata.commandName,
      tenantId,
      serviceId: serviceConfig.serviceId,
    },
    "reservation command accepted from Command Center",
  );
};
