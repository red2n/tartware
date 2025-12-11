import { ReservationEventSchema } from "@tartware/schemas";
import type { Consumer } from "kafkajs";

import { kafkaConfig, serviceConfig } from "../config.js";
import { processReservationEvent } from "../services/reservation-event-handler.js";

import { kafka } from "./client.js";

let consumer: Consumer | null = null;
let consumerReady = false;

export const startReservationConsumer = async (): Promise<void> => {
  if (consumer) {
    return;
  }

  consumer = kafka.consumer({
    groupId: kafkaConfig.consumerGroupId,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: kafkaConfig.topic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return;
      }

      try {
        const parsed = ReservationEventSchema.parse(
          JSON.parse(message.value.toString()),
        );
        await processReservationEvent(parsed);
      } catch (error) {
        console.error(
          `[${serviceConfig.serviceId}] Failed to process reservation event`,
          error,
        );
      }
    },
  });
  consumerReady = true;
};

export const shutdownReservationConsumer = async (): Promise<void> => {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    consumerReady = false;
  }
};

export const isReservationConsumerReady = (): boolean => consumerReady;
