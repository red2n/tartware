/**
 * ChannelCommissionRules Schema
 * @table channel_commission_rules
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete ChannelCommissionRules schema
 */
export const ChannelCommissionRulesSchema = z.object({
	rule_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	channel_name: z.string(),
	ota_config_id: uuid.optional(),
	rule_name: z.string(),
	rule_code: z.string().optional(),
	rule_type: z.string(),
	commission_model: z.string(),
	base_commission_percent: money.optional(),
	base_commission_amount: money.optional(),
	currency: z.string().optional(),
	has_tiers: z.boolean().optional(),
	tier_structure: z.record(z.unknown()).optional(),
	tier_basis: z.string().optional(),
	performance_bonuses: z.record(z.unknown()).optional(),
	volume_discounts: z.record(z.unknown()).optional(),
	applies_to_room_types: z.array(uuid).optional(),
	applies_to_rate_plans: z.array(uuid).optional(),
	excluded_room_types: z.array(uuid).optional(),
	excluded_rate_plans: z.array(uuid).optional(),
	effective_from: z.coerce.date(),
	effective_until: z.coerce.date().optional(),
	is_active: z.boolean().optional(),
	has_seasonal_variations: z.boolean().optional(),
	seasonal_rules: z.record(z.unknown()).optional(),
	minimum_stay_nights: z.number().int().optional(),
	maximum_stay_nights: z.number().int().optional(),
	advance_booking_days: z.number().int().optional(),
	blackout_dates: z.array(z.coerce.date()).optional(),
	applies_to_weekdays: z.boolean().optional(),
	applies_to_weekends: z.boolean().optional(),
	calculate_on: z.string(),
	include_taxes: z.boolean().optional(),
	include_fees: z.boolean().optional(),
	include_services: z.boolean().optional(),
	payment_frequency: z.string().optional(),
	payment_day_of_month: z.number().int().optional(),
	payment_terms_days: z.number().int().optional(),
	max_commission_per_booking: money.optional(),
	min_commission_per_booking: money.optional(),
	max_commission_per_month: money.optional(),
	commission_cap_type: z.string().optional(),
	contract_id: z.string().optional(),
	contract_start_date: z.coerce.date().optional(),
	contract_end_date: z.coerce.date().optional(),
	auto_renewal: z.boolean().optional(),
	renewal_notice_days: z.number().int().optional(),
	can_be_overridden: z.boolean().optional(),
	override_requires_approval: z.boolean().optional(),
	approval_roles: z.array(z.string()).optional(),
	bookings_processed: z.number().int().optional(),
	total_commission_earned: money.optional(),
	last_calculation_date: z.coerce.date().optional(),
	next_review_date: z.coerce.date().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	approval_notes: z.string().optional(),
	priority: z.number().int().optional(),
	conflict_resolution: z.string().optional(),
	description: z.string().optional(),
	internal_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type ChannelCommissionRules = z.infer<
	typeof ChannelCommissionRulesSchema
>;

/**
 * Schema for creating a new channel commission rules
 */
export const CreateChannelCommissionRulesSchema =
	ChannelCommissionRulesSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateChannelCommissionRules = z.infer<
	typeof CreateChannelCommissionRulesSchema
>;

/**
 * Schema for updating a channel commission rules
 */
export const UpdateChannelCommissionRulesSchema =
	ChannelCommissionRulesSchema.partial();

export type UpdateChannelCommissionRules = z.infer<
	typeof UpdateChannelCommissionRulesSchema
>;
