/**
 * DEV DOC
 * Module: schemas/05-operations/minibar-consumption.ts
 * Description: MinibarConsumption Schema
 * Table: minibar_consumption
 * Category: 05-operations
 * Primary exports: MinibarConsumptionSchema, CreateMinibarConsumptionSchema, UpdateMinibarConsumptionSchema
 * @table minibar_consumption
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * MinibarConsumption Schema
 * @table minibar_consumption
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete MinibarConsumption schema
 */
export const MinibarConsumptionSchema = z.object({
	consumption_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	consumption_date: z.coerce.date(),
	consumption_timestamp: z.coerce.date(),
	transaction_number: z.string().optional(),
	reservation_id: uuid,
	guest_id: uuid.optional(),
	room_id: uuid,
	room_number: z.string(),
	folio_id: uuid.optional(),
	item_id: uuid,
	item_code: z.string(),
	item_name: z.string(),
	item_category: z.string().optional(),
	quantity_consumed: z.number().int(),
	unit_of_measure: z.string().optional(),
	unit_price: money,
	subtotal: money,
	tax_rate: money.optional(),
	tax_amount: money.optional(),
	service_charge_rate: money.optional(),
	service_charge_amount: money.optional(),
	total_amount: money,
	currency_code: z.string().optional(),
	detection_method: z.string(),
	detected_by: uuid.optional(),
	detected_by_name: z.string().optional(),
	detected_by_role: z.string().optional(),
	detection_device: z.string().optional(),
	housekeeping_date: z.coerce.date().optional(),
	service_type: z.string().optional(),
	hk_report_id: uuid.optional(),
	verified: z.boolean().optional(),
	verified_by: uuid.optional(),
	verified_at: z.coerce.date().optional(),
	verification_notes: z.string().optional(),
	guest_acknowledged: z.boolean().optional(),
	guest_signature_url: z.string().optional(),
	acknowledged_at: z.coerce.date().optional(),
	disputed: z.boolean().optional(),
	dispute_reason: z.string().optional(),
	dispute_date: z.coerce.date().optional(),
	dispute_resolved: z.boolean().optional(),
	dispute_resolution: z.string().optional(),
	dispute_resolved_date: z.coerce.date().optional(),
	dispute_resolved_by: uuid.optional(),
	adjustment_applied: z.boolean().optional(),
	adjustment_type: z.string().optional(),
	adjustment_amount: money.optional(),
	adjustment_reason: z.string().optional(),
	adjusted_by: uuid.optional(),
	adjusted_at: z.coerce.date().optional(),
	posting_status: z.string(),
	posted_to_folio: z.boolean().optional(),
	posted_at: z.coerce.date().optional(),
	folio_transaction_id: uuid.optional(),
	settled: z.boolean().optional(),
	settled_date: z.coerce.date().optional(),
	payment_method: z.string().optional(),
	inventory_updated: z.boolean().optional(),
	inventory_updated_at: z.coerce.date().optional(),
	stock_depleted: z.number().int().optional(),
	replenishment_required: z.boolean().optional(),
	replenished: z.boolean().optional(),
	replenished_at: z.coerce.date().optional(),
	replenished_by: uuid.optional(),
	is_alcoholic: z.boolean().optional(),
	age_verified: z.boolean().optional(),
	age_verification_method: z.string().optional(),
	age_verified_by: uuid.optional(),
	original_room_id: uuid.optional(),
	consumption_room_match: z.boolean().optional(),
	complimentary: z.boolean().optional(),
	complimentary_reason: z.string().optional(),
	package_included: z.boolean().optional(),
	package_id: uuid.optional(),
	promotional_discount_percent: money.optional(),
	promotional_discount_amount: money.optional(),
	revenue_date: z.coerce.date().optional(),
	revenue_center: z.string().optional(),
	revenue_category: z.string().optional(),
	department_code: z.string().optional(),
	gl_account: z.string().optional(),
	pos_transaction_id: z.string().optional(),
	accounting_posted: z.boolean().optional(),
	accounting_posted_at: z.coerce.date().optional(),
	external_system_id: z.string().optional(),
	batch_id: uuid.optional(),
	batch_date: z.coerce.date().optional(),
	bulk_posted: z.boolean().optional(),
	guest_notes: z.string().optional(),
	special_requests: z.string().optional(),
	preference_recorded: z.boolean().optional(),
	item_condition: z.string().optional(),
	item_expiration_date: z.coerce.date().optional(),
	quality_issue: z.boolean().optional(),
	quality_issue_description: z.string().optional(),
	photo_url: z.string().optional(),
	photo_timestamp: z.coerce.date().optional(),
	internal_notes: z.string().optional(),
	housekeeper_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type MinibarConsumption = z.infer<typeof MinibarConsumptionSchema>;

/**
 * Schema for creating a new minibar consumption
 */
export const CreateMinibarConsumptionSchema = MinibarConsumptionSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateMinibarConsumption = z.infer<
	typeof CreateMinibarConsumptionSchema
>;

/**
 * Schema for updating a minibar consumption
 */
export const UpdateMinibarConsumptionSchema =
	MinibarConsumptionSchema.partial();

export type UpdateMinibarConsumption = z.infer<
	typeof UpdateMinibarConsumptionSchema
>;
