/**
 * TravelAgentCommissions Schema
 * @table travel_agent_commissions
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete TravelAgentCommissions schema
 */
export const TravelAgentCommissionsSchema = z.object({
	commission_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	company_id: uuid,
	reservation_id: uuid,
	commission_period: z.string().optional(),
	period_start_date: z.coerce.date().optional(),
	period_end_date: z.coerce.date().optional(),
	room_revenue: money.optional(),
	food_revenue: money.optional(),
	beverage_revenue: money.optional(),
	spa_revenue: money.optional(),
	other_revenue: money.optional(),
	total_revenue: money,
	commission_type: z.string(),
	room_commission_rate: money.optional(),
	food_beverage_commission_rate: money.optional(),
	spa_commission_rate: money.optional(),
	other_commission_rate: money.optional(),
	overall_commission_rate: money.optional(),
	flat_commission_amount: money.optional(),
	room_commission: money.optional(),
	food_beverage_commission: money.optional(),
	spa_commission: money.optional(),
	other_commission: money.optional(),
	gross_commission: money,
	adjustment_amount: money.optional(),
	adjustment_reason: z.string().optional(),
	tax_deducted: money.optional(),
	withholding_tax_rate: money.optional(),
	cancellation_deduction: money.optional(),
	chargeback_amount: money.optional(),
	net_commission: money.optional(),
	payment_status: z.string().optional(),
	payment_method: z.string().optional(),
	payment_date: z.coerce.date().optional(),
	payment_reference: z.string().optional(),
	payment_id: uuid.optional(),
	invoice_number: z.string().optional(),
	invoice_date: z.coerce.date().optional(),
	invoice_due_date: z.coerce.date().optional(),
	invoice_url: z.string().optional(),
	currency_code: z.string().optional(),
	exchange_rate: money.optional(),
	tier_level: z.number().int().optional(),
	tier_threshold: money.optional(),
	bonus_commission: money.optional(),
	booking_date: z.coerce.date().optional(),
	checkin_date: z.coerce.date().optional(),
	checkout_date: z.coerce.date().optional(),
	number_of_nights: z.number().int().optional(),
	number_of_rooms: z.number().int().optional(),
	guest_name: z.string().optional(),
	confirmation_number: z.string().optional(),
	agency_name: z.string().optional(),
	agency_code: z.string().optional(),
	agent_name: z.string().optional(),
	agent_email: z.string().optional(),
	agent_phone: z.string().optional(),
	tax_id_number: z.string().optional(),
	tax_form_type: z.string().optional(),
	tax_form_submitted: z.boolean().optional(),
	statement_number: z.string().optional(),
	statement_date: z.coerce.date().optional(),
	included_in_statement: z.boolean().optional(),
	requires_approval: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	approval_notes: z.string().optional(),
	reconciled: z.boolean().optional(),
	reconciled_date: z.coerce.date().optional(),
	reconciled_by: uuid.optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type TravelAgentCommissions = z.infer<
	typeof TravelAgentCommissionsSchema
>;

/**
 * Schema for creating a new travel agent commissions
 */
export const CreateTravelAgentCommissionsSchema =
	TravelAgentCommissionsSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateTravelAgentCommissions = z.infer<
	typeof CreateTravelAgentCommissionsSchema
>;

/**
 * Schema for updating a travel agent commissions
 */
export const UpdateTravelAgentCommissionsSchema =
	TravelAgentCommissionsSchema.partial();

export type UpdateTravelAgentCommissions = z.infer<
	typeof UpdateTravelAgentCommissionsSchema
>;
