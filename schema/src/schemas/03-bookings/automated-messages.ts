/**
 * DEV DOC
 * Module: schemas/03-bookings/automated-messages.ts
 * Description: Trigger-based automated guest messaging rules — configures when, how, and to whom
 *   notifications are sent (e.g., pre-arrival emails, checkout reminders, review requests).
 *   Supports multi-channel delivery, frequency capping, A/B testing, and compliance controls.
 * Table: automated_messages
 * Category: 03-bookings
 * Primary exports: AutomatedMessagesSchema, CreateAutomatedMessagesSchema, UpdateAutomatedMessagesSchema
 * @table automated_messages
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Automated guest messaging rules.
 * Each row defines a trigger condition, delivery channel, timing, targeting,
 * frequency controls, and template linkage for automated guest outreach.
 *
 * @table automated_messages
 * @category 03-bookings
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

// ─── Full Row Schema ─────────────────────────────────────────────────────────

/**
 * Complete automated_messages row including system-managed counters,
 * rate metrics, timestamps, and soft-delete flags.
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
 * Schema for creating a new automated message rule.
 * Omits system-generated identifiers, tracking counters, rate metrics,
 * timestamp fields, and soft-delete flags.
 */
export const CreateAutomatedMessagesSchema = AutomatedMessagesSchema.omit({
	message_id: true,
	sent_count: true,
	delivered_count: true,
	opened_count: true,
	clicked_count: true,
	converted_count: true,
	failed_count: true,
	bounced_count: true,
	unsubscribed_count: true,
	delivery_rate: true,
	open_rate: true,
	click_rate: true,
	conversion_rate: true,
	unsubscribe_rate: true,
	last_sent_at: true,
	last_triggered_at: true,
	last_success_at: true,
	last_failure_at: true,
	total_cost: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
});

export type CreateAutomatedMessages = z.infer<
	typeof CreateAutomatedMessagesSchema
>;

/**
 * Schema for updating an automated message rule.
 * Restricts to user-mutable configuration fields only.
 */
export const UpdateAutomatedMessagesSchema = AutomatedMessagesSchema.pick({
	message_name: true,
	message_code: true,
	description: true,
	trigger_event: true,
	is_active: true,
	is_paused: true,
	priority: true,
	send_timing: true,
	delay_minutes: true,
	delay_hours: true,
	delay_days: true,
	send_before_event_hours: true,
	send_after_event_hours: true,
	scheduled_time: true,
	scheduled_timezone: true,
	respect_quiet_hours: true,
	quiet_hours_start: true,
	quiet_hours_end: true,
	template_id: true,
	template_version: true,
	fallback_template_id: true,
	message_channel: true,
	secondary_channels: true,
	channel_priority: true,
	target_audience: true,
	guest_segments: true,
	conditions: true,
	exclusion_conditions: true,
	use_guest_name: true,
	use_property_name: true,
	personalization_fields: true,
	dynamic_content_rules: true,
	default_language: true,
	multi_language: true,
	language_detection_method: true,
	supported_languages: true,
	max_sends_per_guest_per_day: true,
	max_sends_per_guest_per_week: true,
	max_sends_per_guest_per_month: true,
	min_hours_between_sends: true,
	respect_unsubscribe: true,
	respect_preferences: true,
	is_ab_test: true,
	ab_test_variant: true,
	ab_test_percentage: true,
	ab_test_control_group_percentage: true,
	retry_on_failure: true,
	max_retry_attempts: true,
	retry_delay_minutes: true,
	requires_consent: true,
	consent_type: true,
	gdpr_compliant: true,
	include_unsubscribe_link: true,
	estimated_cost_per_send: true,
	currency: true,
	metadata: true,
	tags: true,
	notes: true,
}).partial();

export type UpdateAutomatedMessages = z.infer<
	typeof UpdateAutomatedMessagesSchema
>;
