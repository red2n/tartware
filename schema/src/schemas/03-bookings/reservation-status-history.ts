/**
 * ReservationStatusHistory Schema
 * @table reservation_status_history
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";
import { ReservationStatusEnum } from "../../shared/enums.js";

/**
 * Complete ReservationStatusHistory schema
 */
export const ReservationStatusHistorySchema = z.object({
	id: uuid,
	reservation_id: uuid,
	tenant_id: uuid,
	previous_status: ReservationStatusEnum.optional(),
	new_status: ReservationStatusEnum,
	change_reason: z.string().optional(),
	change_notes: z.string().optional(),
	changed_by: z.string().optional(),
	changed_at: z.coerce.date(),
	metadata: z.record(z.unknown()).optional(),
});

export type ReservationStatusHistory = z.infer<
	typeof ReservationStatusHistorySchema
>;

/**
 * Schema for creating a new reservation status history
 */
export const CreateReservationStatusHistorySchema =
	ReservationStatusHistorySchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateReservationStatusHistory = z.infer<
	typeof CreateReservationStatusHistorySchema
>;

/**
 * Schema for updating a reservation status history
 */
export const UpdateReservationStatusHistorySchema =
	ReservationStatusHistorySchema.partial();

export type UpdateReservationStatusHistory = z.infer<
	typeof UpdateReservationStatusHistorySchema
>;
