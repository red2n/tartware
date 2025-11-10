/**
 * ReservationTraces Schema
 * @table reservation_traces
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete ReservationTraces schema
 */
export const ReservationTracesSchema = z.object({
	trace_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	reservation_id: uuid,
	guest_id: uuid.optional(),
	assigned_to: uuid.optional(),
	created_by: uuid.optional(),
	trace_type: z.string(),
	trace_category: z.string().optional(),
	subject: z.string(),
	description: z.string().optional(),
	priority: z.string().optional(),
	due_date: z.coerce.date(),
	due_time: z.string().optional(),
	status: z.string(),
	completed_at: z.coerce.date().optional(),
	completed_by: uuid.optional(),
	completion_notes: z.string().optional(),
	alert_channels: z.array(z.string()).optional(),
	alert_trigger: z.string().optional(),
	snoozed_until: z.coerce.date().optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type ReservationTraces = z.infer<typeof ReservationTracesSchema>;

/**
 * Schema for creating a new reservation traces
 */
export const CreateReservationTracesSchema = ReservationTracesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateReservationTraces = z.infer<
	typeof CreateReservationTracesSchema
>;

/**
 * Schema for updating a reservation traces
 */
export const UpdateReservationTracesSchema = ReservationTracesSchema.partial();

export type UpdateReservationTraces = z.infer<
	typeof UpdateReservationTracesSchema
>;
