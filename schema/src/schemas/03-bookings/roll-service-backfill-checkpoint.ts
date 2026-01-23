/**
 * DEV DOC
 * Module: schemas/03-bookings/roll-service-backfill-checkpoint.ts
 * Description: Roll Service Backfill Checkpoint Schema
 * Table: roll_service_backfill_checkpoint
 * Category: 03-bookings
 * Primary exports: RollServiceBackfillCheckpointSchema, CreateRollServiceBackfillCheckpointSchema, UpdateRollServiceBackfillCheckpointSchema
 * @table roll_service_backfill_checkpoint
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Roll Service Backfill Checkpoint Schema
 * @table roll_service_backfill_checkpoint
 * @category 03-bookings
 * @synchronized 2026-01-22
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const RollServiceBackfillCheckpointSchema = z.object({
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	last_event_id: uuid.optional(),
	last_event_created_at: z.date().optional(),
	updated_at: z.date(),
});

export type RollServiceBackfillCheckpoint = z.infer<	typeof RollServiceBackfillCheckpointSchema
>;

export const CreateRollServiceBackfillCheckpointSchema =
	RollServiceBackfillCheckpointSchema.omit({
		updated_at: true,
	});

export type CreateRollServiceBackfillCheckpoint = z.infer<
	typeof CreateRollServiceBackfillCheckpointSchema
>;

export const UpdateRollServiceBackfillCheckpointSchema =
	RollServiceBackfillCheckpointSchema.partial().extend({
		tenant_id: uuid,
	});

export type UpdateRollServiceBackfillCheckpoint = z.infer<
	typeof UpdateRollServiceBackfillCheckpointSchema
>;
