/**
 * DEV DOC
 * Module: schemas/03-bookings/roll-service-consumer-offsets.ts
 * Description: Roll Service Consumer Offsets Schema
 * Table: roll_service_consumer_offsets
 * Category: 03-bookings
 * Primary exports: RollServiceConsumerOffsetsSchema, CreateRollServiceConsumerOffsetsSchema, UpdateRollServiceConsumerOffsetsSchema
 * @table roll_service_consumer_offsets
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Roll Service Consumer Offsets Schema
 * @table roll_service_consumer_offsets
 * @category 03-bookings
 * @synchronized 2026-01-22
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const RollServiceConsumerOffsetsSchema = z.object({
	consumer_group: z.string(),
	topic: z.string(),
	partition: z.number().int(),
	offset_position: z.bigint(),
	high_watermark: z.bigint().nullable().optional(),
	last_event_id: uuid.optional(),
	last_event_created_at: z.date().optional(),
	updated_at: z.date(),
});

export type RollServiceConsumerOffset = z.infer<	typeof RollServiceConsumerOffsetsSchema
>;

export const CreateRollServiceConsumerOffsetsSchema =
	RollServiceConsumerOffsetsSchema.omit({
		updated_at: true,
	});

export type CreateRollServiceConsumerOffset = z.infer<
	typeof CreateRollServiceConsumerOffsetsSchema
>;

export const UpdateRollServiceConsumerOffsetsSchema =
	RollServiceConsumerOffsetsSchema.partial().extend({
		consumer_group: z.string(),
		topic: z.string(),
		partition: z.number().int(),
	});

export type UpdateRollServiceConsumerOffset = z.infer<	typeof UpdateRollServiceConsumerOffsetsSchema
>;
