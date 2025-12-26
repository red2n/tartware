/**
 * BusinessDates Schema
 * @table business_dates
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete BusinessDates schema
 */
export const BusinessDatesSchema = z.object({
	business_date_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	business_date: z.coerce.date(),
	system_date: z.coerce.date(),
	date_status: z.string(),
	night_audit_status: z.string().optional(),
	night_audit_started_at: z.coerce.date().optional(),
	night_audit_completed_at: z.coerce.date().optional(),
	night_audit_started_by: uuid.optional(),
	night_audit_completed_by: uuid.optional(),
	previous_business_date: z.coerce.date().optional(),
	date_rolled_at: z.coerce.date().optional(),
	date_rolled_by: uuid.optional(),
	date_opened_at: z.coerce.date(),
	date_opened_by: uuid.optional(),
	date_closed_at: z.coerce.date().optional(),
	date_closed_by: uuid.optional(),
	arrivals_count: z.number().int().optional(),
	departures_count: z.number().int().optional(),
	stayovers_count: z.number().int().optional(),
	reservations_created: z.number().int().optional(),
	reservations_cancelled: z.number().int().optional(),
	total_revenue: money.optional(),
	total_payments: money.optional(),
	allow_new_reservations: z.boolean().optional(),
	allow_check_ins: z.boolean().optional(),
	allow_check_outs: z.boolean().optional(),
	allow_postings: z.boolean().optional(),
	is_locked: z.boolean().optional(),
	locked_at: z.coerce.date().optional(),
	locked_by: uuid.optional(),
	lock_reason: z.string().optional(),
	audit_errors: z.number().int().optional(),
	audit_warnings: z.number().int().optional(),
	audit_notes: z.string().optional(),
	is_reconciled: z.boolean().optional(),
	reconciled_at: z.coerce.date().optional(),
	reconciled_by: uuid.optional(),
	notes: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type BusinessDates = z.infer<typeof BusinessDatesSchema>;

/**
 * Schema for creating a new business dates
 */
export const CreateBusinessDatesSchema = BusinessDatesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateBusinessDates = z.infer<typeof CreateBusinessDatesSchema>;

/**
 * Schema for updating a business dates
 */
export const UpdateBusinessDatesSchema = BusinessDatesSchema.partial();

export type UpdateBusinessDates = z.infer<typeof UpdateBusinessDatesSchema>;
