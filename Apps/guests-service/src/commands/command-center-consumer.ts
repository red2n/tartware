import type { CommandEnvelope, CommandMetadata } from "@tartware/command-consumer-utils";
import { createIdempotencyHandlers } from "@tartware/command-consumer-utils/idempotency";
import { createConsumerLifecycle } from "@tartware/command-consumer-utils/lifecycle";
import { enterTenantScope } from "@tartware/config/db";
import {
  ReservationMobileCheckinCompleteCommandSchema,
  ReservationMobileCheckinStartCommandSchema,
} from "@tartware/schemas";
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
import { completeMobileCheckin, startMobileCheckin } from "../services/checkin-service.js";
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

const guestExperienceLogger = appLogger.child({
  module: "guest-experience-command-consumer",
});

/**
 * Route guest-experience commands (mobile check-in) to their handlers.
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
        initiatedBy: metadata.initiatedBy?.userId ?? null,
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
      guestExperienceLogger.debug(
        { commandName: metadata.commandName },
        "no guest-experience handler registered for command",
      );
  }
};

const { start: startGE, shutdown: shutdownGE } = createConsumerLifecycle({
  kafka,
  commandCenterConfig: {
    ...config.commandCenter,
    consumerGroupId: config.guestExperienceCommandCenter.consumerGroupId,
    targetServiceId: config.guestExperienceCommandCenter.targetServiceId,
  },
  serviceName: config.service.name,
  commandLabel: "guest-experience",
  logger: guestExperienceLogger,
  routeCommand: routeGuestExperienceCommand,
  publishDlqEvent,
  onTenantResolved: enterTenantScope,
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

export const startGuestExperienceCommandConsumer = startGE;
export const shutdownGuestExperienceCommandConsumer = shutdownGE;
