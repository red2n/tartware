/**
 * DEV DOC
 * Module: schemas/03-bookings/reservation-guard-locks.ts
 * Description: Reservation Guard Locks Schema
 * Table: reservation_guard_locks
 * Category: 03-bookings
 * Primary exports: ReservationGuardLocksSchema, CreateReservationGuardLocksSchema, UpdateReservationGuardLocksSchema
 * @table reservation_guard_locks
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Reservation Guard Locks Schema
 * @table reservation_guard_locks
 * @category 03-bookings
 * @synchronized 2026-01-22
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";

export const ReservationGuardLocksSchema = z.object({
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	reservation_id: uuid,
	lock_id: uuid.nullable().optional(),
	status: z.string(),
	metadata: jsonbMetadata,
	updated_at: z.date(),
});

export type ReservationGuardLock = z.infer<typeof ReservationGuardLocksSchema>;

export const CreateReservationGuardLocksSchema =
	ReservationGuardLocksSchema.omit({
		updated_at: true,
	});

export type CreateReservationGuardLock = z.infer<
	typeof CreateReservationGuardLocksSchema
>;

export const UpdateReservationGuardLocksSchema =
	ReservationGuardLocksSchema.partial().extend({
		tenant_id: uuid,
		reservation_id: uuid,
	});

export type UpdateReservationGuardLock = z.infer<
	typeof UpdateReservationGuardLocksSchema
>;
