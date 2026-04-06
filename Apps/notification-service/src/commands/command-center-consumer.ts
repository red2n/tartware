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
  handleCreateAutomatedMessage,
  handleCreateTemplate,
  handleDeleteAutomatedMessage,
  handleDeleteTemplate,
  handleSendNotification,
  handleUpdateAutomatedMessage,
  handleUpdateTemplate,
} from "../services/notification-command-service.js";

const logger = appLogger.child({ module: "notification-command-consumer" });

/**
 * Route notification commands to their handlers.
 */
const routeNotificationCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  switch (metadata.commandName) {
    case "notification.send":
      await handleSendNotification(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.template.create":
      await handleCreateTemplate(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.template.update":
      await handleUpdateTemplate(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.template.delete":
      await handleDeleteTemplate(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.automated.create":
      await handleCreateAutomatedMessage(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.automated.update":
      await handleUpdateAutomatedMessage(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "notification.automated.delete":
      await handleDeleteAutomatedMessage(envelope.payload as Record<string, unknown>, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug(
        { commandName: metadata.commandName },
        "no notification handler registered for command",
      );
  }
};

const { start, shutdown } = createConsumerLifecycle({
  kafka,
  commandCenterConfig: config.commandCenter,
  serviceName: config.service.name,
  commandLabel: "notification",
  logger,
  routeCommand: routeNotificationCommand,
  publishDlqEvent,
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

export const startNotificationCommandCenterConsumer = start;
export const shutdownNotificationCommandCenterConsumer = shutdown;
