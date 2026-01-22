/**
 * DEV DOC
 * Module: schemas/03-bookings/roll-service-shadow-ledgers.ts
 * Description: Roll Service Shadow Ledgers Schema
 * Table: roll_service_shadow_ledgers
 * Category: 03-bookings
 * Primary exports: RollServiceShadowLedgersSchema, CreateRollServiceShadowLedgersSchema, UpdateRollServiceShadowLedgersSchema
 * @table roll_service_shadow_ledgers
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Roll Service Shadow Ledgers Schema
 * @table roll_service_shadow_ledgers
 * @category 03-bookings
 * @synchronized 2026-01-22
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const RollServiceShadowLedgersSchema = z.object({
	ledger_id: uuid,
	tenant_id: uuid,
	reservation_id: uuid.optional(),
	lifecycle_event_id: uuid,
	roll_type: z.string(),
	roll_date: z.date(),
	occurred_at: z.date(),
	source_event_type: z.string(),
	event_payload: z.record(z.unknown()),
	created_at: z.date(),
	updated_at: z.date(),
});

export type RollServiceShadowLedger = z.infer<	typeof RollServiceShadowLedgersSchema
>;

export const CreateRollServiceShadowLedgersSchema =
	RollServiceShadowLedgersSchema.omit({
		ledger_id: true,
		created_at: true,
		updated_at: true,
	});

export type CreateRollServiceShadowLedger = z.infer<
	typeof CreateRollServiceShadowLedgersSchema
>;

export const UpdateRollServiceShadowLedgersSchema =
	RollServiceShadowLedgersSchema.partial().extend({
		ledger_id: uuid,
	});

export type UpdateRollServiceShadowLedger = z.infer<
	typeof UpdateRollServiceShadowLedgersSchema
>;
