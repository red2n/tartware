/**
 * Reservation Lifecycle Events Schema
 * @table reservation_lifecycle_events
 * @category 01-core
 * Purpose: Authoritative ledger for lifecycle guard checkpoints
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";
import { ReservationLifecycleStateEnum } from "../../shared/enums.js";

export const ReservationLifecycleEventSchema = z.object({
	id: z.bigint(),
	correlation_id: uuid,
	reservation_id: uuid.optional(),
	tenant_id: uuid,
	state: ReservationLifecycleStateEnum,
	checkpoint_source: z.string(),
	checkpoint_actor: z.string().nullable().optional(),
	checkpoint_payload: z.record(z.unknown()).default({}),
	reason: z.string().nullable().optional(),
	metadata: jsonbMetadata,
	checkpointed_at: z.date(),
	expires_at: z.date().nullable().optional(),
	created_at: z.date(),
});

export type ReservationLifecycleEvent = z.infer<
	typeof ReservationLifecycleEventSchema
>;

export const CreateReservationLifecycleEventSchema =
	ReservationLifecycleEventSchema.omit({
		id: true,
		created_at: true,
		checkpointed_at: true,
	});
export type CreateReservationLifecycleEvent = z.infer<
	typeof CreateReservationLifecycleEventSchema
>;

export const UpdateReservationLifecycleEventSchema =
	ReservationLifecycleEventSchema.partial().extend({
		id: z.bigint(),
	});
export type UpdateReservationLifecycleEvent = z.infer<
	typeof UpdateReservationLifecycleEventSchema
>;
