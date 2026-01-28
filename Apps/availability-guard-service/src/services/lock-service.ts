import { performance } from "node:perf_hooks";

import { v4 as uuid } from "uuid";

import { config } from "../config.js";
import { withTransaction } from "../lib/db.js";
import {
  observeGuardRequestDuration,
  recordGuardRequest,
  recordLockConflict,
} from "../lib/metrics.js";
import {
  bulkReleaseLocks,
  findConflictingLock,
  type InventoryLock,
  insertLock,
  releaseLockRecord,
} from "../repositories/lock-repository.js";
import type {
  BulkReleaseInput,
  LockRoomInput,
  ReleaseLockInput,
} from "../types/lock-types.js";

const secondsSince = (startedAt: number): number =>
  (performance.now() - startedAt) / 1000;

type LockRoomResult =
  | { status: "LOCKED"; lock: InventoryLock }
  | { status: "CONFLICT"; conflict: InventoryLock };

/**
 * Acquire an inventory lock for a room or room type.
 */
export const lockRoom = async (
  input: LockRoomInput,
): Promise<LockRoomResult> => {
  const startedAt = performance.now();
  try {
    const result = await withTransaction(async (client) => {
      const conflict = await findConflictingLock(
        client,
        input,
        input.idempotencyKey ?? input.reservationId,
      );
      if (conflict) {
        recordLockConflict(input.tenantId);
        return { status: "CONFLICT", conflict } as LockRoomResult;
      }

      const ttlSeconds = Math.min(
        input.ttlSeconds ?? config.guard.defaultTtlSeconds,
        config.guard.maxTtlSeconds,
      );
      const expiresAt =
        ttlSeconds > 0
          ? new Date(
              Math.min(input.stayEnd.getTime(), Date.now() + ttlSeconds * 1000),
            )
          : null;

      const lock = await insertLock(client, {
        ...input,
        lockId: input.idempotencyKey ?? uuid(),
        ttlSeconds,
        expiresAt,
      });
      return { status: "LOCKED", lock } as LockRoomResult;
    });

    recordGuardRequest(
      "lockRoom",
      result.status === "LOCKED" ? "success" : "conflict",
    );
    return result;
  } catch (error) {
    recordGuardRequest("lockRoom", "error");
    throw error;
  } finally {
    observeGuardRequestDuration("lockRoom", secondsSince(startedAt));
  }
};

/**
 * Release a single inventory lock.
 */
export const releaseLock = async (
  input: ReleaseLockInput,
): Promise<InventoryLock | null> => {
  const startedAt = performance.now();
  try {
    const result = await withTransaction((client) =>
      releaseLockRecord(client, {
        ...input,
        releasedAt: new Date(),
      }),
    );
    recordGuardRequest("releaseLock", result ? "success" : "error");
    return result;
  } catch (error) {
    recordGuardRequest("releaseLock", "error");
    throw error;
  } finally {
    observeGuardRequestDuration("releaseLock", secondsSince(startedAt));
  }
};

/**
 * Release multiple inventory locks in bulk.
 */
export const releaseLocksInBulk = async (
  input: BulkReleaseInput,
): Promise<number> => {
  const startedAt = performance.now();
  try {
    const released = await bulkReleaseLocks({
      ...input,
      releasedAt: new Date(),
    });
    recordGuardRequest("bulkRelease", "success");
    return released;
  } catch (error) {
    recordGuardRequest("bulkRelease", "error");
    throw error;
  } finally {
    observeGuardRequestDuration("bulkRelease", secondsSince(startedAt));
  }
};
