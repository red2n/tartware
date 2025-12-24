/**
 * Reservation Command Lifecycle Schema
 * @table reservation_command_lifecycle
 * @category 03-bookings
 * @synchronized 2025-12-23
 *
 * Purpose: Lifecycle guard snapshots for reservation command pipeline.
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";
import { ReservationCommandLifecycleStateEnum } from "../../shared/enums.js";

const LifecycleTransitionSchema = z.object({
	state: ReservationCommandLifecycleStateEnum,
	timestamp: z.union([z.string(), z.date()]),
	actor: z.string().optional(),
	details: z.record(z.unknown()).optional(),
});

export const ReservationCommandLifecycleSchema = z.object({
	event_id: uuid,
	tenant_id: uuid,
	reservation_id: uuid.optional(),
	command_name: z.string(),
	correlation_id: z.string().nullable().optional(),
	partition_key: z.string().nullable().optional(),
	current_state: ReservationCommandLifecycleStateEnum,
	state_transitions: z.array(LifecycleTransitionSchema),
	metadata: jsonbMetadata,
	created_at: z.date(),
	updated_at: z.date(),
});
export type ReservationCommandLifecycle = z.infer<
	typeof ReservationCommandLifecycleSchema
>;

export const CreateReservationCommandLifecycleSchema =
	ReservationCommandLifecycleSchema.omit({
		created_at: true,
		updated_at: true,
		state_transitions: true,
	});
export type CreateReservationCommandLifecycle = z.infer<
	typeof CreateReservationCommandLifecycleSchema
>;

export const UpdateReservationCommandLifecycleSchema =
	ReservationCommandLifecycleSchema.partial().extend({
		event_id: uuid,
	});
export type UpdateReservationCommandLifecycle = z.infer<
	typeof UpdateReservationCommandLifecycleSchema
>;
