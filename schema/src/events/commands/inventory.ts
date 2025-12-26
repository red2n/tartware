import { z } from "zod";

export const InventoryLockRoomCommandSchema = z.object({
  tenantId: z.string().uuid(),
  reservationId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  roomId: z.string().uuid().optional().nullable(),
  stayStart: z.coerce.date(),
  stayEnd: z.coerce.date(),
  reason: z.string().min(1).default("RESERVATION_CREATE"),
  correlationId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  ttlSeconds: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type InventoryLockRoomCommand = z.infer<
  typeof InventoryLockRoomCommandSchema
>;

export const InventoryReleaseRoomCommandSchema = z.object({
  tenantId: z.string().uuid(),
  lockId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  reason: z.string().min(1).default("RELEASE_REQUEST"),
  correlationId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type InventoryReleaseRoomCommand = z.infer<
  typeof InventoryReleaseRoomCommandSchema
>;

export const InventoryBulkReleaseCommandSchema = z.object({
  tenantId: z.string().uuid(),
  lockIds: z.array(z.string().uuid()).min(1),
  reason: z.string().min(1).default("BULK_RELEASE"),
  correlationId: z.string().optional(),
});
export type InventoryBulkReleaseCommand = z.infer<
  typeof InventoryBulkReleaseCommandSchema
>;
