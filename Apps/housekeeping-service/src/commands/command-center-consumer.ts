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
  cashierHandover,
  closeCashierSession,
  openCashierSession,
} from "../services/cashier-commands.js";
import {
  addHousekeepingTaskNote,
  assignHousekeepingTask,
  bulkUpdateHousekeepingStatus,
  completeHousekeepingTask,
  createHousekeepingTask,
  reassignHousekeepingTask,
  reopenHousekeepingTask,
} from "../services/housekeeping-command-service.js";
import {
  assignMaintenanceRequest,
  completeMaintenanceRequest,
  createMaintenanceRequest,
  escalateMaintenanceRequest,
} from "../services/maintenance-command-service.js";
import { createStaffSchedule, updateStaffSchedule } from "../services/schedule-command-service.js";

const logger = appLogger.child({ module: "housekeeping-command-consumer" });

const routeHousekeepingCommand = async (
  envelope: CommandEnvelope,
  metadata: CommandMetadata,
): Promise<void> => {
  switch (metadata.commandName) {
    case "housekeeping.task.assign":
      await assignHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.complete":
      await completeHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.create":
      await createHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.reassign":
      await reassignHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.reopen":
      await reopenHousekeepingTask(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.add_note":
      await addHousekeepingTaskNote(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "housekeeping.task.bulk_status":
      await bulkUpdateHousekeepingStatus(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "operations.schedule.create":
      await createStaffSchedule(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "operations.schedule.update":
      await updateStaffSchedule(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "operations.maintenance.request":
      await createMaintenanceRequest(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "operations.maintenance.assign":
      await assignMaintenanceRequest(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "operations.maintenance.complete":
      await completeMaintenanceRequest(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "operations.maintenance.escalate":
      await escalateMaintenanceRequest(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.cashier.open":
      await openCashierSession(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.cashier.close":
      await closeCashierSession(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    case "billing.cashier.handover":
      await cashierHandover(envelope.payload, {
        tenantId: metadata.tenantId,
        initiatedBy: metadata.initiatedBy ?? null,
      });
      return;
    default:
      logger.debug({ commandName: metadata.commandName }, "no housekeeping handler for command");
  }
};

const { start, shutdown } = createConsumerLifecycle({
  kafka,
  commandCenterConfig: config.commandCenter,
  serviceName: config.service.name,
  commandLabel: "housekeeping",
  logger,
  routeCommand: routeHousekeepingCommand,
  publishDlqEvent,
  metrics: {
    recordOutcome: recordCommandOutcome,
    observeDuration: observeCommandDuration,
    setConsumerLag: setCommandConsumerLag,
  },
});

export const startHousekeepingCommandCenterConsumer = start;
export const shutdownHousekeepingCommandCenterConsumer = shutdown;
