/**
 * DEV DOC
 * Module: types/lock-types.ts
 * Purpose: Re-export lock schemas from @tartware/schemas
 * Ownership: availability-guard-service
 */

import {
  LockRoomSchema,
  ReleaseLockSchema,
  BulkReleaseSchema,
  ManualReleaseSchema,
  type LockRoomInput,
  type ReleaseLockInput,
  type BulkReleaseInput,
  type ManualReleaseInput,
} from "@tartware/schemas";

// Re-export with lowercase names for backward compatibility
export const lockRoomSchema = LockRoomSchema;
export const releaseLockSchema = ReleaseLockSchema;
export const bulkReleaseSchema = BulkReleaseSchema;
export const manualReleaseSchema = ManualReleaseSchema;

export type { LockRoomInput, ReleaseLockInput, BulkReleaseInput, ManualReleaseInput };
