import {
  type CommandEnvelope,
  type CommandMetadata,
  createCommandCenterHandlers,
} from "@tartware/command-consumer-utils";
import type { Consumer } from "kafkajs";

import { commandCenterConfig } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishCommandDlqEvent } from "../kafka/producer.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  setCommandConsumerLag,
} from "../lib/metrics.js";
import { processWithRetry, RetryExhaustedError } from "@tartware/config/retry";
import { reservationsLogger } from "../logger.js";
import {
  checkCommandIdempotency,
  recordCommandIdempotency,
} from "../repositories/idempotency-repository.js";
import {
  GroupAddRoomsCommandSchema,
  GroupBillingSetupCommandSchema,
  GroupCreateCommandSchema,
  GroupCutoffEnforceCommandSchema,
  GroupUploadRoomingListCommandSchema,
  IntegrationMappingUpdateCommandSchema,
  IntegrationOtaRatePushCommandSchema,
  IntegrationOtaSyncRequestCommandSchema,
  IntegrationWebhookRetryCommandSchema,
  MetasearchClickRecordCommandSchema,
  MetasearchConfigCreateCommandSchema,
  MetasearchConfigUpdateCommandSchema,
  ReservationAssignRoomCommandSchema,
  ReservationBatchNoShowCommandSchema,
  ReservationCancelCommandSchema,
  ReservationCheckInCommandSchema,
  ReservationCheckOutCommandSchema,
  ReservationConvertQuoteCommandSchema,
  ReservationCreateCommandSchema,
  ReservationDepositAddCommandSchema,
  ReservationDepositReleaseCommandSchema,
  ReservationExpireCommandSchema,
  ReservationExtendStayCommandSchema,
  ReservationGenerateRegCardCommandSchema,
  ReservationMobileCheckinCompleteCommandSchema,
  ReservationMobileCheckinStartCommandSchema,
  ReservationModifyCommandSchema,
  ReservationNoShowCommandSchema,
  ReservationRateOverrideCommandSchema,
  ReservationSendQuoteCommandSchema,
  ReservationUnassignRoomCommandSchema,
  ReservationWaitlistAddCommandSchema,
  ReservationWaitlistConvertCommandSchema,
  ReservationWaitlistExpireSweepCommandSchema,
  ReservationWaitlistOfferCommandSchema,
  ReservationWalkGuestCommandSchema,
  ReservationWalkInCheckInCommandSchema,
} from "../schemas/reservation-command.js";
import {
  addDeposit,
  addGroupRooms,
  assignRoom,
  batchNoShowSweep,
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  completeMobileCheckin,
  convertQuote,
  createGroupBooking,
  createMetasearchConfig,
  createReservation,
  enforceGroupCutoff,
  expireReservation,
  extendStay,
  generateRegistrationCard,
  markNoShow,
  modifyReservation,
  otaRatePush,
  otaSyncRequest,
  overrideRate,
  processOtaReservationQueue,
  recordMetasearchClick,
  releaseDeposit,
  sendQuote,
  setupGroupBilling,
  startMobileCheckin,
  unassignRoom,
  updateIntegrationMapping,
  updateMetasearchConfig,
  uploadGroupRoomingList,
  waitlistAdd,
  waitlistConvert,
  waitlistExpireSweep,
  waitlistOffer,
  walkGuest,
  walkInCheckIn,
  webhookRetry,
} from "../services/reservation-command-service.js";

let commandConsumer: Consumer | null = null;
const logger = reservationsLogger.child({ module: "command-center-consumer" });

export const startCommandCenterConsumer = async (): Promise<void> => {
  if (commandConsumer) {
    return;
  }

  commandConsumer = kafka.consumer({
    groupId: commandCenterConfig.consumerGroupId,
    allowAutoTopicCreation: false,
    maxBytesPerPartition: commandCenterConfig.maxBatchBytes,
  });

  await commandConsumer.connect();
  await commandConsumer.subscribe({
    topic: commandCenterConfig.topic,
    fromBeginning: false,
  });

  await commandConsumer.run({
    autoCommit: false,
    eachBatchAutoResolve: false,
    eachBatch: handleBatch,
  });

  logger.info(
    {
      topic: commandCenterConfig.topic,
      groupId: commandCenterConfig.consumerGroupId,
      targetService: commandCenterConfig.targetServiceId,
    },
    "reservation command consumer started",
  );
};

export const shutdownCommandCenterConsumer = async (): Promise<void> => {
  if (commandConsumer) {
    await commandConsumer.disconnect();
    commandConsumer = null;
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
 * Routes a validated command envelope to the appropriate reservation handler.
 */
const routeReservationCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  const rawCorrelation = metadata.correlationId ?? metadata.requestId;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const context = {
    correlationId: rawCorrelation && UUID_RE.test(rawCorrelation) ? rawCorrelation : undefined,
  };

  switch (metadata.commandName) {
    case "reservation.create": {
      const commandPayload = ReservationCreateCommandSchema.parse(envelope.payload);
      await createReservation(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.modify": {
      const commandPayload = ReservationModifyCommandSchema.parse(envelope.payload);
      await modifyReservation(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.cancel": {
      const commandPayload = ReservationCancelCommandSchema.parse(envelope.payload);
      await cancelReservation(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.check_in": {
      const commandPayload = ReservationCheckInCommandSchema.parse(envelope.payload);
      await checkInReservation(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.check_out": {
      const commandPayload = ReservationCheckOutCommandSchema.parse(envelope.payload);
      await checkOutReservation(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.assign_room": {
      const commandPayload = ReservationAssignRoomCommandSchema.parse(envelope.payload);
      await assignRoom(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.unassign_room": {
      const commandPayload = ReservationUnassignRoomCommandSchema.parse(envelope.payload);
      await unassignRoom(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.extend_stay": {
      const commandPayload = ReservationExtendStayCommandSchema.parse(envelope.payload);
      await extendStay(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.rate_override": {
      const commandPayload = ReservationRateOverrideCommandSchema.parse(envelope.payload);
      await overrideRate(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.add_deposit": {
      const commandPayload = ReservationDepositAddCommandSchema.parse(envelope.payload);
      await addDeposit(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.release_deposit": {
      const commandPayload = ReservationDepositReleaseCommandSchema.parse(envelope.payload);
      await releaseDeposit(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.no_show": {
      const commandPayload = ReservationNoShowCommandSchema.parse(envelope.payload);
      await markNoShow(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.batch_no_show": {
      const commandPayload = ReservationBatchNoShowCommandSchema.parse(envelope.payload);
      await batchNoShowSweep(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.walkin_checkin": {
      const commandPayload = ReservationWalkInCheckInCommandSchema.parse(envelope.payload);
      await walkInCheckIn(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.waitlist_add": {
      const commandPayload = ReservationWaitlistAddCommandSchema.parse(envelope.payload);
      await waitlistAdd(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.waitlist_convert": {
      const commandPayload = ReservationWaitlistConvertCommandSchema.parse(envelope.payload);
      await waitlistConvert(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.waitlist_offer": {
      const commandPayload = ReservationWaitlistOfferCommandSchema.parse(envelope.payload);
      await waitlistOffer(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.waitlist_expire_sweep": {
      const commandPayload = ReservationWaitlistExpireSweepCommandSchema.parse(envelope.payload);
      await waitlistExpireSweep(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.generate_registration_card": {
      const commandPayload = ReservationGenerateRegCardCommandSchema.parse(envelope.payload);
      await generateRegistrationCard(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.mobile_checkin.start": {
      const commandPayload = ReservationMobileCheckinStartCommandSchema.parse(envelope.payload);
      await startMobileCheckin(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.mobile_checkin.complete": {
      const commandPayload = ReservationMobileCheckinCompleteCommandSchema.parse(envelope.payload);
      await completeMobileCheckin(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.send_quote": {
      const commandPayload = ReservationSendQuoteCommandSchema.parse(envelope.payload);
      await sendQuote(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.convert_quote": {
      const commandPayload = ReservationConvertQuoteCommandSchema.parse(envelope.payload);
      await convertQuote(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.expire": {
      const commandPayload = ReservationExpireCommandSchema.parse(envelope.payload);
      await expireReservation(metadata.tenantId, commandPayload, context);
      break;
    }
    case "reservation.walk_guest": {
      const commandPayload = ReservationWalkGuestCommandSchema.parse(envelope.payload);
      await walkGuest(metadata.tenantId, commandPayload, context);
      break;
    }
    case "group.create": {
      const commandPayload = GroupCreateCommandSchema.parse(envelope.payload);
      await createGroupBooking(metadata.tenantId, commandPayload, context);
      break;
    }
    case "group.add_rooms": {
      const commandPayload = GroupAddRoomsCommandSchema.parse(envelope.payload);
      await addGroupRooms(metadata.tenantId, commandPayload, context);
      break;
    }
    case "group.upload_rooming_list": {
      const commandPayload = GroupUploadRoomingListCommandSchema.parse(envelope.payload);
      await uploadGroupRoomingList(metadata.tenantId, commandPayload, context);
      break;
    }
    case "group.cutoff_enforce": {
      const commandPayload = GroupCutoffEnforceCommandSchema.parse(envelope.payload);
      await enforceGroupCutoff(metadata.tenantId, commandPayload, context);
      break;
    }
    case "group.billing.setup": {
      const commandPayload = GroupBillingSetupCommandSchema.parse(envelope.payload);
      await setupGroupBilling(metadata.tenantId, commandPayload, context);
      break;
    }
    case "integration.ota.sync_request": {
      const commandPayload = IntegrationOtaSyncRequestCommandSchema.parse(envelope.payload);
      await otaSyncRequest(metadata.tenantId, commandPayload, context);
      // Also process inbound reservation queue after sync
      await processOtaReservationQueue(metadata.tenantId, commandPayload.property_id, context);
      break;
    }
    case "integration.ota.rate_push": {
      const commandPayload = IntegrationOtaRatePushCommandSchema.parse(envelope.payload);
      await otaRatePush(metadata.tenantId, commandPayload, context);
      break;
    }
    case "integration.webhook.retry": {
      const commandPayload = IntegrationWebhookRetryCommandSchema.parse(envelope.payload);
      await webhookRetry(metadata.tenantId, commandPayload, context);
      break;
    }
    case "integration.mapping.update": {
      const commandPayload = IntegrationMappingUpdateCommandSchema.parse(envelope.payload);
      await updateIntegrationMapping(metadata.tenantId, commandPayload, context);
      break;
    }
    case "metasearch.config.create": {
      const commandPayload = MetasearchConfigCreateCommandSchema.parse(envelope.payload);
      await createMetasearchConfig(metadata.tenantId, commandPayload, context);
      break;
    }
    case "metasearch.config.update": {
      const commandPayload = MetasearchConfigUpdateCommandSchema.parse(envelope.payload);
      await updateMetasearchConfig(metadata.tenantId, commandPayload, context);
      break;
    }
    case "metasearch.click.record": {
      const commandPayload = MetasearchClickRecordCommandSchema.parse(envelope.payload);
      await recordMetasearchClick(metadata.tenantId, commandPayload, context);
      break;
    }
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no reservation handler registered for command",
      );
      return;
  }
};

const { handleBatch } = createCommandCenterHandlers({
  targetServiceId: commandCenterConfig.targetServiceId,
  serviceName: "reservations-command-service",
  logger,
  retry: {
    maxRetries: commandCenterConfig.maxRetries,
    baseDelayMs: commandCenterConfig.retryBackoffMs,
    delayScheduleMs:
      commandCenterConfig.retryScheduleMs.length > 0
        ? commandCenterConfig.retryScheduleMs
        : undefined,
  },
  processWithRetry,
  RetryExhaustedError,
  publishDlqEvent: publishCommandDlqEvent,
  buildDlqPayload,
  routeCommand: routeReservationCommand,
  commandLabel: "reservation",
  checkIdempotency: checkCommandIdempotency,
  recordIdempotency: recordCommandIdempotency,
  idempotencyFailureMode: "fail-open",
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});
