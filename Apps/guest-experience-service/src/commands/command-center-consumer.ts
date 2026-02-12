import {
  type CommandEnvelope,
  type CommandMetadata,
  createCommandCenterHandlers,
} from "@tartware/command-consumer-utils";
import type { Consumer } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishDlqEvent } from "../kafka/producer.js";
import { appLogger } from "../lib/logger.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  setCommandConsumerLag,
} from "../lib/metrics.js";
import { processWithRetry, RetryExhaustedError } from "../lib/retry.js";
import {
  startMobileCheckin,
  completeMobileCheckin,
} from "../services/checkin-service.js";
import {
  ReservationMobileCheckinStartCommandSchema,
  ReservationMobileCheckinCompleteCommandSchema,
} from "@tartware/schemas";

let consumer: Consumer | null = null;
const logger = appLogger.child({ module: "guest-experience-command-consumer" });

export const startGuestExperienceCommandConsumer = async (): Promise<void> => {
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
    "guest-experience command consumer started",
  );
};

export const shutdownGuestExperienceCommandConsumer = async (): Promise<void> => {
  if (!consumer) {
    return;
  }
  try {
    await consumer.disconnect();
    logger.info("guest-experience command consumer disconnected");
  } finally {
    consumer = null;
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

/**
 * Route guest-experience commands to their handlers.
 */
const routeGuestExperienceCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  const payload = envelope.payload as Record<string, unknown>;

  switch (metadata.commandName) {
    case "reservation.mobile_checkin.start": {
      const parsed = ReservationMobileCheckinStartCommandSchema.parse(payload);
      await startMobileCheckin({
        reservationId: parsed.reservation_id,
        tenantId: metadata.tenantId,
        guestId: parsed.guest_id,
        accessMethod: parsed.access_method,
        deviceType: parsed.device_type,
        appVersion: parsed.app_version,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    }
    case "reservation.mobile_checkin.complete": {
      const parsed = ReservationMobileCheckinCompleteCommandSchema.parse(payload);
      await completeMobileCheckin({
        mobileCheckinId: parsed.mobile_checkin_id,
        identityVerificationMethod: parsed.identity_verification_method,
        idDocumentVerified: parsed.id_document_verified,
        registrationCardSigned: parsed.registration_card_signed,
        paymentMethodVerified: parsed.payment_method_verified,
        termsAccepted: parsed.terms_accepted,
        roomId: parsed.room_id,
        digitalKeyType: parsed.digital_key_type,
        guestSignatureUrl: parsed.guest_signature_url,
      });
      return;
    }
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no guest-experience handler registered for command",
      );
  }
};

const { handleBatch } = createCommandCenterHandlers({
  targetServiceId: config.commandCenter.targetServiceId,
  serviceName: config.service.name,
  logger,
  retry: {
    maxRetries: config.commandCenter.maxRetries,
    baseDelayMs: config.commandCenter.retryBackoffMs,
    delayScheduleMs:
      config.commandCenter.retryScheduleMs.length > 0
        ? config.commandCenter.retryScheduleMs
        : undefined,
  },
  processWithRetry,
  RetryExhaustedError,
  publishDlqEvent,
  buildDlqPayload,
  routeCommand: routeGuestExperienceCommand,
  commandLabel: "guest-experience",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});
