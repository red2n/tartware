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
 *
 * `roomId` and `ttlSeconds` use `preprocess` to coerce proto3 default values
 * (`""` for strings, `0` for uint32) into `null` / `undefined` so downstream
 * validation (UUID format, positive integer) does not reject them.
 */
export const LockRoomSchema = z.object({
	tenantId: uuid,
	reservationId: uuid,
	roomTypeId: uuid,
	roomId: z.preprocess(
		(v) => (v === "" ? null : v),
		uuid.nullable().optional(),
	),
	stayStart: z.coerce.date(),
	stayEnd: z.coerce.date(),
	reason: z.string().min(1).default("RESERVATION_CREATE"),
	correlationId: z.string().optional(),
	idempotencyKey: z.string().optional(),
	ttlSeconds: z.preprocess(
		(v) => (v === 0 ? undefined : v),
		z.number().int().positive().optional(),
	),
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

// -----------------------------------------------------------------------------
// Lock Response
// -----------------------------------------------------------------------------

/** Lock response schema (LOCKED or CONFLICT). */
export const LockResponseSchema = z.union([
	z.object({
		status: z.literal("LOCKED"),
		lock: z.object({
			id: uuid,
			reservation_id: uuid.nullable(),
			room_type_id: uuid,
			room_id: uuid.nullable(),
			stay_start: z.string(),
			stay_end: z.string(),
			expires_at: z.string().nullable(),
		}),
	}),
	z.object({
		status: z.literal("CONFLICT"),
		conflict: z.object({
			id: uuid,
			reservation_id: uuid.nullable(),
			room_type_id: uuid,
			room_id: uuid.nullable(),
			stay_start: z.string(),
			stay_end: z.string(),
		}),
	}),
]);

export type LockResponse = z.infer<typeof LockResponseSchema>;

/** Manual release notification test request body. */
export const ManualReleaseNotificationTestSchema = z.object({
	lockId: uuid,
	tenantId: uuid,
	reservationId: uuid.optional().nullable(),
	roomTypeId: uuid,
	roomId: uuid.optional().nullable(),
	stayStart: z.coerce.date(),
	stayEnd: z.coerce.date(),
	reason: z.string().min(1),
	actorId: z.string().min(1),
	actorName: z.string().min(1),
	actorEmail: z.string().email().optional(),
	recipients: z.array(z.string().min(3)).nonempty(),
});

export type ManualReleaseNotificationTest = z.infer<
	typeof ManualReleaseNotificationTestSchema
>;
