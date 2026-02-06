import { performance } from "node:perf_hooks";

import type { FastifyBaseLogger } from "fastify";

import { withTransaction } from "../lib/db.js";
import { observeGuardRequestDuration, recordGuardRequest } from "../lib/metrics.js";
import { sendManualReleaseNotification } from "../lib/notification-dispatcher.js";
import { insertLockAuditRecord } from "../repositories/audit-repository.js";
import type { InventoryLock } from "../repositories/lock-repository.js";
import { releaseLockRecord } from "../repositories/lock-repository.js";

type ManualReleaseInput = {
  tenantId: string;
  lockId: string;
  reason: string;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  reservationId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  notify?: string[];
};

type ManualReleaseResult = {
  lock: InventoryLock;
  auditId: string;
};

const secondsSince = (startedAt: number): number => (performance.now() - startedAt) / 1000;

/**
 * Manually release an inventory lock and emit audit/notification.
 */
export const manualReleaseLock = async (
  input: ManualReleaseInput,
  logger: FastifyBaseLogger,
): Promise<ManualReleaseResult | null> => {
  const startedAt = performance.now();
  try {
    const result = await withTransaction(async (client) => {
      const releasedLock = await releaseLockRecord(client, {
        tenantId: input.tenantId,
        lockId: input.lockId,
        reservationId: input.reservationId,
        reason: input.reason,
        correlationId: input.correlationId ?? input.actorId,
        metadata: {
          ...(input.metadata ?? {}),
          manualRelease: {
            actorId: input.actorId,
            actorName: input.actorName,
            actorEmail: input.actorEmail ?? null,
            reason: input.reason,
          },
        },
        releasedAt: new Date(),
      });

      if (!releasedLock) {
        return null;
      }

      const auditRecord = await insertLockAuditRecord(client, {
        lockId: releasedLock.id,
        tenantId: releasedLock.tenant_id,
        action: "MANUAL_RELEASE",
        actorId: input.actorId,
        actorName: input.actorName,
        actorEmail: input.actorEmail ?? null,
        reason: input.reason,
        metadata: input.metadata ?? {},
      });

      return {
        lock: releasedLock,
        auditId: auditRecord.id,
      };
    });
    recordGuardRequest("manualRelease", result ? "success" : "error");

    if (!result) {
      return null;
    }

    await sendManualReleaseNotification(
      {
        lockId: result.lock.id,
        tenantId: result.lock.tenant_id,
        reservationId: result.lock.reservation_id,
        roomTypeId: result.lock.room_type_id,
        roomId: result.lock.room_id,
        stayStart: result.lock.stay_start.toISOString(),
        stayEnd: result.lock.stay_end.toISOString(),
        reason: input.reason,
        actor: {
          id: input.actorId,
          name: input.actorName,
          email: input.actorEmail ?? null,
        },
        recipients: input.notify ?? [],
      },
      logger,
    );

    return result;
  } catch (error) {
    recordGuardRequest("manualRelease", "error");
    logger.error({ err: error, lockId: input.lockId }, "Manual release failed");
    throw error;
  } finally {
    observeGuardRequestDuration("manualRelease", secondsSince(startedAt));
  }
};
