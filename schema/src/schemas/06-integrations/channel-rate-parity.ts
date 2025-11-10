/**
 * ChannelRateParity Schema
 * @table channel_rate_parity
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete ChannelRateParity schema
 */
export const ChannelRateParitySchema = z.object({
	parity_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	rate_plan_id: uuid.optional(),
	check_date: z.coerce.date(),
	pms_rate: money,
	pms_currency: z.string(),
	channel_rates: z.record(z.unknown()),
	is_parity_maintained: z.boolean().optional(),
	parity_status: z.string(),
	violations_detected: z.number().int().optional(),
	violation_details: z.record(z.unknown()).optional(),
	max_variance_percent: money.optional(),
	max_variance_amount: money.optional(),
	acceptable_variance_percent: money.optional(),
	acceptable_variance_amount: money.optional(),
	lowest_rate: money.optional(),
	lowest_rate_channel: z.string().optional(),
	highest_rate: money.optional(),
	highest_rate_channel: z.string().optional(),
	rate_spread: money.optional(),
	rate_spread_percent: money.optional(),
	bar_rate: money.optional(),
	bar_channel: z.string().optional(),
	is_direct_booking_cheaper: z.boolean().optional(),
	direct_booking_advantage: money.optional(),
	check_initiated_at: z.coerce.date(),
	check_completed_at: z.coerce.date().optional(),
	channels_checked: z.number().int().optional(),
	channels_responding: z.number().int().optional(),
	channels_failed: z.number().int().optional(),
	alert_sent: z.boolean().optional(),
	alert_sent_at: z.coerce.date().optional(),
	alert_recipients: z.array(z.string()).optional(),
	alert_severity: z.string().optional(),
	is_resolved: z.boolean().optional(),
	resolved_at: z.coerce.date().optional(),
	resolved_by: uuid.optional(),
	resolution_action: z.string().optional(),
	resolution_notes: z.string().optional(),
	auto_correction_attempted: z.boolean().optional(),
	auto_correction_successful: z.boolean().optional(),
	correction_timestamp: z.coerce.date().optional(),
	correction_details: z.record(z.unknown()).optional(),
	previous_check_id: uuid.optional(),
	is_recurring_violation: z.boolean().optional(),
	consecutive_violations: z.number().int().optional(),
	first_violation_date: z.coerce.date().optional(),
	market_position: z.string().optional(),
	competitor_rates: z.record(z.unknown()).optional(),
	market_average_rate: money.optional(),
	scrape_method: z.string().optional(),
	scrape_duration_ms: z.number().int().optional(),
	scrape_errors: z.record(z.unknown()).optional(),
	contract_restrictions: z.record(z.unknown()).optional(),
	contract_violation_risk: z.string().optional(),
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

export type ChannelRateParity = z.infer<typeof ChannelRateParitySchema>;

/**
 * Schema for creating a new channel rate parity
 */
export const CreateChannelRateParitySchema = ChannelRateParitySchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateChannelRateParity = z.infer<
	typeof CreateChannelRateParitySchema
>;

/**
 * Schema for updating a channel rate parity
 */
export const UpdateChannelRateParitySchema = ChannelRateParitySchema.partial();

export type UpdateChannelRateParity = z.infer<
	typeof UpdateChannelRateParitySchema
>;
