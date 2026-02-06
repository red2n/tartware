import type { FastifyBaseLogger } from "fastify";
import type { Producer } from "kafkajs";

import { config } from "../config.js";

import { kafka } from "./kafka.js";

type ManualReleaseNotificationPayload = {
  lockId: string;
  tenantId: string;
  reservationId: string | null;
  roomTypeId: string;
  roomId: string | null;
  stayStart: string;
  stayEnd: string;
  reason: string;
  actor: {
    id: string;
    name: string;
    email?: string | null;
  };
  recipients: string[];
};

let producer: Producer | null = null;
let connectPromise: Promise<void> | null = null;

const ensureProducer = async (): Promise<Producer> => {
  if (!producer) {
    producer = kafka.producer();
  }
  if (!connectPromise) {
    connectPromise = producer.connect().catch((error) => {
      connectPromise = null;
      throw error;
    });
  }
  await connectPromise;
  return producer;
};

const dedupe = (values: string[]): string[] => {
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
};

export const sendManualReleaseNotification = async (
  payload: ManualReleaseNotificationPayload,
  logger: FastifyBaseLogger,
): Promise<void> => {
  if (!config.guard.manualRelease.notifications.enabled) {
    logger.debug("Manual release notifications disabled; skipping dispatch");
    return;
  }

  const recipients = dedupe([
    ...payload.recipients,
    ...config.guard.manualRelease.notifications.recipients,
  ]);

  if (recipients.length === 0) {
    logger.warn(
      { lockId: payload.lockId },
      "Manual release notification skipped; no recipients configured",
    );
    return;
  }

  try {
    const notificationProducer = await ensureProducer();
    await notificationProducer.send({
      topic: config.guard.manualRelease.notifications.topic,
      messages: [
        {
          key: payload.lockId,
          value: JSON.stringify({
            type: "availability_guard.manual_release",
            sentAt: new Date().toISOString(),
            lockId: payload.lockId,
            tenantId: payload.tenantId,
            reservationId: payload.reservationId,
            roomTypeId: payload.roomTypeId,
            roomId: payload.roomId,
            stayStart: payload.stayStart,
            stayEnd: payload.stayEnd,
            reason: payload.reason,
            actor: payload.actor,
            recipients,
          }),
          headers: {
            "lock-id": Buffer.from(payload.lockId),
            "tenant-id": Buffer.from(payload.tenantId),
            "event-type": Buffer.from("availability_guard.manual_release"),
          },
        },
      ],
    });
    logger.info(
      {
        lockId: payload.lockId,
        recipients,
      },
      "Manual release notification dispatched",
    );
  } catch (error) {
    logger.error(
      { err: error, lockId: payload.lockId },
      "Failed to dispatch manual release notification",
    );
  }
};

export const shutdownNotificationDispatcher = async (): Promise<void> => {
  if (!producer) {
    return;
  }
  try {
    await producer.disconnect();
  } finally {
    producer = null;
    connectPromise = null;
  }
};
