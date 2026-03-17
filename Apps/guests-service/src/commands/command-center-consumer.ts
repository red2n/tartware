import {
  type CommandEnvelope,
  type CommandMetadata,
  createCommandCenterHandlers,
} from "@tartware/command-consumer-utils";
import { buildDlqPayload } from "@tartware/command-consumer-utils/dlq";
import { processWithRetry, RetryExhaustedError } from "@tartware/config/retry";
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
import {
  earnLoyaltyPoints,
  expireLoyaltyPoints,
  redeemLoyaltyPoints,
} from "../services/loyalty-command-service.js";

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

const routeCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
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
    case "loyalty.points.earn":
      await earnLoyaltyPoints({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "loyalty.points.redeem":
      await redeemLoyaltyPoints({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "loyalty.points.expire_sweep":
      await expireLoyaltyPoints({
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

const { handleBatch } = createCommandCenterHandlers({
  targetServiceId: config.commandCenter.targetServiceId,
  serviceName: config.service.name,
  logger: consumerLogger,
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
  routeCommand,
  commandLabel: "guest",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

const handleGuestRegisterCommand = async (
  payload: unknown,
  metadata: CommandMetadata,
): Promise<void> => {
  const parsedPayload = GuestRegisterCommandSchema.parse(payload);
  await registerGuestProfile({
    tenantId: metadata.tenantId as string,
    payload: parsedPayload,
    correlationId: metadata.correlationId ?? metadata.requestId,
    initiatedBy: metadata.initiatedBy ?? null,
  });
};
