/**
 * DEV DOC
 * Module: api/availability-guard.ts
 * Purpose: Availability Guard lock API schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

/**
 * Lock room request schema.
 */
export const LockRoomSchema = z.object({
	tenantId: uuid,
	reservationId: uuid,
	roomTypeId: uuid,
	roomId: uuid.nullable().optional(),
	stayStart: z.coerce.date(),
	stayEnd: z.coerce.date(),
	reason: z.string().min(1).default("RESERVATION_CREATE"),
	correlationId: z.string().optional(),
	idempotencyKey: z.string().optional(),
	ttlSeconds: z.number().int().positive().optional(),
	metadata: z.record(z.any()).optional(),
});

export type LockRoomInput = z.infer<typeof LockRoomSchema>;

/**
 * Release lock request schema.
 */
export const ReleaseLockSchema = z.object({
	tenantId: uuid,
	lockId: uuid,
	reservationId: uuid.optional(),
	reason: z.string().default("RELEASE_REQUEST"),
	correlationId: z.string().optional(),
	metadata: z.record(z.any()).optional(),
});

export type ReleaseLockInput = z.infer<typeof ReleaseLockSchema>;

/**
 * Bulk release request schema.
 */
export const BulkReleaseSchema = z.object({
	tenantId: uuid,
	lockIds: z.array(uuid).nonempty(),
	reason: z.string().default("BULK_RELEASE"),
	correlationId: z.string().optional(),
});

export type BulkReleaseInput = z.infer<typeof BulkReleaseSchema>;

/**
 * Manual release request schema.
 */
export const ManualReleaseSchema = z.object({
	tenantId: uuid,
	reservationId: uuid.optional(),
	reason: z.string().min(3),
	actorId: z.string().min(1),
	actorName: z.string().min(1),
	actorEmail: z.string().email().optional(),
	correlationId: z.string().optional(),
	metadata: z.record(z.any()).optional(),
	notify: z.array(z.string().email()).optional(),
});

export type ManualReleaseInput = z.infer<typeof ManualReleaseSchema>;
