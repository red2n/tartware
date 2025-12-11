import { randomUUID } from "node:crypto";

import { reliabilityConfig } from "../config.js";
import { reservationsLogger } from "../logger.js";
import {
  ReservationCancelCommandSchema,
  ReservationCreateCommandSchema,
  ReservationUpdateCommandSchema,
  type ReservationCancelCommand,
  type ReservationCreateCommand,
  type ReservationUpdateCommand,
} from "../schemas/reservation-command.js";
import {
  type IdempotencyRecord,
  claimRetryBatch,
  markIdempotencyRecordAcked,
  markIdempotencyRecordFailed,
} from "./idempotency-service.js";
import {
  cancelReservation,
  createReservation,
  updateReservation,
} from "./reservation-command-service.js";

let sweepHandle: NodeJS.Timeout | null = null;
let isRunning = false;
const workerId = `retry-worker-${randomUUID()}`;

const dispatchCommand = async (
  record: IdempotencyRecord,
): Promise<{ eventId: string; correlationId?: string; status: "accepted" }> => {
  const correlationId = record.correlation_id ?? undefined;
  switch (record.command_type) {
    case "reservation.create":
      return createReservation(
        record.tenant_id,
        ReservationCreateCommandSchema.parse(
          record.payload ?? {},
        ) as ReservationCreateCommand,
        { correlationId },
      );
    case "reservation.update":
      if (!record.resource_id) {
        throw new Error("Missing reservation id for retry");
      }
      return updateReservation(
        record.tenant_id,
        record.resource_id,
        ReservationUpdateCommandSchema.parse(
          record.payload ?? {},
        ) as ReservationUpdateCommand,
        { correlationId },
      );
    case "reservation.cancel":
      if (!record.resource_id) {
        throw new Error("Missing reservation id for retry");
      }
      return cancelReservation(
        record.tenant_id,
        record.resource_id,
        ReservationCancelCommandSchema.parse(
          record.payload ?? {},
        ) as ReservationCancelCommand,
        { correlationId },
      );
    default:
      throw new Error(`Unsupported command type ${record.command_type}`);
  }
};

const runSweep = async (): Promise<void> => {
  if (isRunning) {
    return;
  }
  isRunning = true;
  try {
    const batch = await claimRetryBatch(
      workerId,
      reliabilityConfig.retryBatchSize,
    );
    if (batch.length === 0) {
      return;
    }

    for (const record of batch) {
      try {
        const result = await dispatchCommand(record);
        const responsePayload = {
          status: result.status,
          eventId: result.eventId,
          correlationId: result.correlationId,
          retried: true,
        };
        await markIdempotencyRecordAcked(
          record.id,
          result.eventId,
          responsePayload,
        );
      } catch (error) {
        reservationsLogger.error(
          {
            err: error,
            idempotencyId: record.id,
            tenantId: record.tenant_id,
            commandType: record.command_type,
          },
          "retry attempt failed",
        );
        await markIdempotencyRecordFailed(record, error);
      }
    }
  } catch (error) {
    reservationsLogger.error(error, "reliability sweep failed");
  } finally {
    isRunning = false;
  }
};

export const startCommandRetryWorker = (): void => {
  if (sweepHandle) {
    return;
  }
  sweepHandle = setInterval(runSweep, reliabilityConfig.retrySweepIntervalMs);
  void runSweep();
};

export const stopCommandRetryWorker = (): void => {
  if (!sweepHandle) {
    return;
  }
  clearInterval(sweepHandle);
  sweepHandle = null;
};
