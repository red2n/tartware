/**
 * DEV DOC
 * Module: schemas/03-bookings/deposit-schedules.ts
 * Description: DepositSchedules Schema
 * Table: deposit_schedules
 * Category: 03-bookings
 * Primary exports: DepositSchedulesSchema, CreateDepositSchedulesSchema, UpdateDepositSchedulesSchema
 * @table deposit_schedules
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * DepositSchedules Schema
 * @table deposit_schedules
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete DepositSchedules schema
 */
export const DepositSchedulesSchema = z.object({
	schedule_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	reservation_id: uuid,
	guest_id: uuid.optional(),
	folio_id: uuid.optional(),
	schedule_number: z.string().optional(),
	schedule_type: z.string(),
	amount_due: money,
	amount_paid: money.optional(),
	amount_remaining: money,
	currency_code: z.string().optional(),
	calculation_method: z.string().optional(),
	percentage_of_total: money.optional(),
	number_of_nights: z.number().int().optional(),
	due_date: z.coerce.date(),
	due_time: z.string().optional(),
	due_offset_days: z.number().int().optional(),
	reference_date_type: z.string().optional(),
	schedule_status: z.string(),
	first_payment_date: z.coerce.date().optional(),
	last_payment_date: z.coerce.date().optional(),
	paid_at: z.coerce.date().optional(),
	paid_by: uuid.optional(),
	is_overdue: z.boolean().optional(),
	overdue_since: z.coerce.date().optional(),
	overdue_amount: money.optional(),
	grace_period_days: z.number().int().optional(),
	reminder_sent_count: z.number().int().optional(),
	last_reminder_sent_at: z.coerce.date().optional(),
	next_reminder_date: z.coerce.date().optional(),
	is_waived: z.boolean().optional(),
	waived_amount: money.optional(),
	waived_at: z.coerce.date().optional(),
	waived_by: uuid.optional(),
	waiver_reason: z.string().optional(),
	waiver_approved_by: uuid.optional(),
	policy_code: z.string().optional(),
	policy_name: z.string().optional(),
	is_refundable: z.boolean().optional(),
	refund_deadline: z.coerce.date().optional(),
	cancellation_fee_percent: money.optional(),
	is_mandatory: z.boolean().optional(),
	blocks_check_in: z.boolean().optional(),
	allowed_payment_methods: z.array(z.string()).optional(),
	preferred_payment_method: z.string().optional(),
	payment_ids: z.array(uuid).optional(),
	is_posted: z.boolean().optional(),
	posted_at: z.coerce.date().optional(),
	posted_by: uuid.optional(),
	posting_id: uuid.optional(),
	sequence_number: z.number().int().optional(),
	total_installments: z.number().int().optional(),
	parent_schedule_id: uuid.optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	guest_instructions: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type DepositSchedules = z.infer<typeof DepositSchedulesSchema>;

/**
 * Schema for creating a new deposit schedules
 */
export const CreateDepositSchedulesSchema = DepositSchedulesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateDepositSchedules = z.infer<
	typeof CreateDepositSchedulesSchema
>;

/**
 * Schema for updating a deposit schedules
 */
export const UpdateDepositSchedulesSchema = DepositSchedulesSchema.partial();

export type UpdateDepositSchedules = z.infer<
	typeof UpdateDepositSchedulesSchema
>;
