import {
  type CommandEnvelope,
  type CommandMetadata,
} from "@tartware/command-consumer-utils";
import { createConsumerLifecycle } from "@tartware/command-consumer-utils/lifecycle";
import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishDlqEvent } from "../kafka/producer.js";
import { appLogger } from "../lib/logger.js";
import {
  observeCommandDuration,
  recordCommandOutcome,
  setCommandConsumerLag,
} from "../lib/metrics.js";
import {
  handleKeyIssue,
  handleKeyRevoke,
  handleRoomFeaturesUpdate,
  handleRoomHousekeepingStatusUpdate,
  handleRoomInventoryCommand,
  handleRoomInventoryRelease,
  handleRoomMove,
  handleRoomOutOfOrder,
  handleRoomOutOfService,
  handleRoomStatusUpdate,
} from "../services/room-command-service.js";

const logger = appLogger.child({ module: "rooms-command-consumer" });

const routeRoomCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  switch (metadata.commandName) {
    case "rooms.inventory.block":
      await handleRoomInventoryCommand(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "rooms.inventory.release":
      await handleRoomInventoryRelease(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "rooms.status.update":
      await handleRoomStatusUpdate(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "rooms.housekeeping_status.update":
      await handleRoomHousekeepingStatusUpdate(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "rooms.out_of_order":
      await handleRoomOutOfOrder(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "rooms.out_of_service":
      await handleRoomOutOfService(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "rooms.move":
      await handleRoomMove(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "rooms.features.update":
      await handleRoomFeaturesUpdate(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "rooms.key.issue":
      await handleKeyIssue(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "rooms.key.revoke":
      await handleKeyRevoke(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug(
        {
          commandName: metadata.commandName,
        },
        "no command handler registered for rooms service",
      );
  }
};

const { start, shutdown } = createConsumerLifecycle({
  kafka,
  commandCenterConfig: config.commandCenter,
  serviceName: config.service.name,
  commandLabel: "room",
  logger,
  routeCommand: routeRoomCommand,
  publishDlqEvent,
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

export const startRoomsCommandCenterConsumer = start;
export const shutdownRoomsCommandCenterConsumer = shutdown;
