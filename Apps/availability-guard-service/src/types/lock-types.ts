import { z } from "zod";

export const lockRoomSchema = z.object({
  tenantId: z.string().uuid(),
  reservationId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  roomId: z.string().uuid().nullable().optional(),
  stayStart: z.coerce.date(),
  stayEnd: z.coerce.date(),
  reason: z.string().min(1).default("RESERVATION_CREATE"),
  correlationId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  ttlSeconds: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional(),
});
export type LockRoomInput = z.infer<typeof lockRoomSchema>;

export const releaseLockSchema = z.object({
  tenantId: z.string().uuid(),
  lockId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  reason: z.string().default("RELEASE_REQUEST"),
  correlationId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});
export type ReleaseLockInput = z.infer<typeof releaseLockSchema>;

export const bulkReleaseSchema = z.object({
  tenantId: z.string().uuid(),
  lockIds: z.array(z.string().uuid()).nonempty(),
  reason: z.string().default("BULK_RELEASE"),
  correlationId: z.string().optional(),
});
export type BulkReleaseInput = z.infer<typeof bulkReleaseSchema>;

export const manualReleaseSchema = z.object({
  tenantId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  reason: z.string().min(3),
  actorId: z.string().min(1),
  actorName: z.string().min(1),
  actorEmail: z.string().email().optional(),
  correlationId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  notify: z.array(z.string().email()).optional(),
});
export type ManualReleaseInput = z.infer<typeof manualReleaseSchema>;
