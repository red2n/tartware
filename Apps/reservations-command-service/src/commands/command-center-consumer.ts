import type { Consumer } from "kafkajs";

import { commandCenterConfig, kafkaConfig, serviceConfig } from "../config.js";
import { kafka } from "../kafka/client.js";
import { reservationsLogger } from "../logger.js";
import {
  ReservationCancelCommandSchema,
  ReservationCreateCommandSchema,
  ReservationModifyCommandSchema,
} from "../schemas/reservation-command.js";
import {
  cancelReservation,
  createReservation,
  modifyReservation,
} from "../services/reservation-command-service.js";

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

      await routeReservationCommand(envelope, metadata).catch((error) => {
        reservationsLogger.error(
          { err: error, metadata },
          "Failed to process reservation command",
        );
      });
    },
  });
};

export const shutdownCommandCenterConsumer = async (): Promise<void> => {
  if (commandConsumer) {
    await commandConsumer.disconnect();
    commandConsumer = null;
  }
};

const routeReservationCommand = async (
  envelope: CommandEnvelope,
  metadata: NonNullable<CommandEnvelope["metadata"]>,
): Promise<void> => {
  switch (metadata.commandName) {
    case "reservation.create": {
      const commandPayload = ReservationCreateCommandSchema.parse(
        envelope.payload,
      );
      await createReservation(metadata.tenantId as string, commandPayload, {
        correlationId: metadata.correlationId ?? metadata.requestId,
      });
      break;
    }
    case "reservation.modify": {
      const commandPayload = ReservationModifyCommandSchema.parse(
        envelope.payload,
      );
      await modifyReservation(metadata.tenantId as string, commandPayload, {
        correlationId: metadata.correlationId ?? metadata.requestId,
      });
      break;
    }
    case "reservation.cancel": {
      const commandPayload = ReservationCancelCommandSchema.parse(
        envelope.payload,
      );
      await cancelReservation(metadata.tenantId as string, commandPayload, {
        correlationId: metadata.correlationId ?? metadata.requestId,
      });
      break;
    }
    default:
      reservationsLogger.debug(
        { commandName: metadata.commandName },
        "no reservation handler registered for command",
      );
      return;
  }

  reservationsLogger.info(
    {
      commandName: metadata.commandName,
      tenantId: metadata.tenantId,
      serviceId: serviceConfig.serviceId,
    },
    "reservation command accepted from Command Center",
  );
};
