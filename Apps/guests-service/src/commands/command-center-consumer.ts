import type { CommandEnvelope, CommandMetadata } from "@tartware/command-consumer-utils";
import { createIdempotencyHandlers } from "@tartware/command-consumer-utils/idempotency";
import { createConsumerLifecycle } from "@tartware/command-consumer-utils/lifecycle";
import { enterTenantScope } from "@tartware/config/db";
import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishDlqEvent } from "../kafka/producer.js";
import { pool } from "../lib/db.js";
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
  updateGuestConsentDecision,
  updateGuestContact,
  updateGuestPreferences,
  updateGuestProfile,
} from "../services/guest-command-service.js";
import {
  earnLoyaltyPoints,
  enrollLoyaltyProgram,
  expireLoyaltyPoints,
  redeemLoyaltyPoints,
} from "../services/loyalty-command-service.js";

const consumerLogger = appLogger.child({
  module: "guests-command-center-consumer",
});

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
    case "guest.consent.update":
      await updateGuestConsentDecision({
        tenantId: metadata.tenantId,
        payload: envelope.payload,
        correlationId: metadata.correlationId ?? metadata.requestId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      break;
    case "loyalty.program.enroll":
      await enrollLoyaltyProgram({
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

const { start: startGuests, shutdown: shutdownGuests } = createConsumerLifecycle({
  kafka,
  commandCenterConfig: config.commandCenter,
  serviceName: config.service.name,
  commandLabel: "guest",
  logger: consumerLogger,
  routeCommand,
  publishDlqEvent,
  onTenantResolved: enterTenantScope,
  ...createIdempotencyHandlers(pool),
  idempotencyFailureMode: "fail-open",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

export const startGuestsCommandCenterConsumer = startGuests;
export const shutdownGuestsCommandCenterConsumer = shutdownGuests;

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

// ─── Guest Experience Consumer (merged from guest-experience-service) ─────────
