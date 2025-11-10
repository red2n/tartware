/**
 * AutomatedMessages Schema
 * @table automated_messages
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete AutomatedMessages schema
 */
export const AutomatedMessagesSchema = z.object({
	message_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	message_name: z.string(),
	message_code: z.string().optional(),
	description: z.string().optional(),
	trigger_type: z.string(),
	trigger_event: z.string().optional(),
	is_active: z.boolean().optional(),
	is_paused: z.boolean().optional(),
	priority: z.number().int().optional(),
	send_timing: z.string().optional(),
	delay_minutes: z.number().int().optional(),
	delay_hours: z.number().int().optional(),
	delay_days: z.number().int().optional(),
	send_before_event_hours: z.number().int().optional(),
	send_after_event_hours: z.number().int().optional(),
	scheduled_time: z.string().optional(),
	scheduled_timezone: z.string().optional(),
	respect_quiet_hours: z.boolean().optional(),
	quiet_hours_start: z.string().optional(),
	quiet_hours_end: z.string().optional(),
	template_id: uuid.optional(),
	template_version: z.number().int().optional(),
	fallback_template_id: uuid.optional(),
	message_channel: z.string(),
	secondary_channels: z.array(z.string()).optional(),
	channel_priority: z.array(z.string()).optional(),
	target_audience: z.array(z.string()).optional(),
	guest_segments: z.array(uuid).optional(),
	conditions: z.record(z.unknown()).optional(),
	exclusion_conditions: z.record(z.unknown()).optional(),
	use_guest_name: z.boolean().optional(),
	use_property_name: z.boolean().optional(),
	personalization_fields: z.record(z.unknown()).optional(),
	dynamic_content_rules: z.record(z.unknown()).optional(),
	default_language: z.string().optional(),
	multi_language: z.boolean().optional(),
	language_detection_method: z.string().optional(),
	supported_languages: z.array(z.string()).optional(),
	max_sends_per_guest_per_day: z.number().int().optional(),
	max_sends_per_guest_per_week: z.number().int().optional(),
	max_sends_per_guest_per_month: z.number().int().optional(),
	min_hours_between_sends: z.number().int().optional(),
	respect_unsubscribe: z.boolean().optional(),
	respect_preferences: z.boolean().optional(),
	is_ab_test: z.boolean().optional(),
	ab_test_variant: z.string().optional(),
	ab_test_percentage: z.number().int().optional(),
	ab_test_control_group_percentage: z.number().int().optional(),
	sent_count: z.number().int().optional(),
	delivered_count: z.number().int().optional(),
	opened_count: z.number().int().optional(),
	clicked_count: z.number().int().optional(),
	converted_count: z.number().int().optional(),
	failed_count: z.number().int().optional(),
	bounced_count: z.number().int().optional(),
	unsubscribed_count: z.number().int().optional(),
	delivery_rate: money.optional(),
	open_rate: money.optional(),
	click_rate: money.optional(),
	conversion_rate: money.optional(),
	unsubscribe_rate: money.optional(),
	last_sent_at: z.coerce.date().optional(),
	last_triggered_at: z.coerce.date().optional(),
	last_success_at: z.coerce.date().optional(),
	last_failure_at: z.coerce.date().optional(),
	retry_on_failure: z.boolean().optional(),
	max_retry_attempts: z.number().int().optional(),
	retry_delay_minutes: z.number().int().optional(),
	requires_consent: z.boolean().optional(),
	consent_type: z.string().optional(),
	gdpr_compliant: z.boolean().optional(),
	include_unsubscribe_link: z.boolean().optional(),
	estimated_cost_per_send: money.optional(),
	total_cost: money.optional(),
	currency: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	tags: z.array(z.string()).optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type AutomatedMessages = z.infer<typeof AutomatedMessagesSchema>;

/**
 * Schema for creating a new automated messages
 */
export const CreateAutomatedMessagesSchema = AutomatedMessagesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAutomatedMessages = z.infer<
	typeof CreateAutomatedMessagesSchema
>;

/**
 * Schema for updating a automated messages
 */
export const UpdateAutomatedMessagesSchema = AutomatedMessagesSchema.partial();

export type UpdateAutomatedMessages = z.infer<
	typeof UpdateAutomatedMessagesSchema
>;
