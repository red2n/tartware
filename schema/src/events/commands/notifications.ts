/**
 * DEV DOC
 * Module: events/commands/notifications.ts
 * Description: Notification command schemas for guest communication dispatch, template CRUD, and automated message configuration
 * Primary exports: NotificationSendCommandSchema, NotificationTemplateCreateCommandSchema, NotificationTemplateUpdateCommandSchema, NotificationTemplateDeleteCommandSchema, NotificationAutomatedMessageCreateCommandSchema, NotificationAutomatedMessageUpdateCommandSchema, NotificationAutomatedMessageDeleteCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

// ─── Send Notification ───────────────────────────────────────────────────────

/**
 * Send a notification to a guest using a communication template.
 * Renders the template with context variables and dispatches
 * via the configured provider (console, webhook, email, SMS).
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const NotificationSendCommandSchema = z.object({
	// Target Guest
	guest_id: z.string().uuid(),
	property_id: z.string().uuid(),

	// Template
	template_code: z.string().min(1).max(100),

	// Recipient Override
	recipient_name: z.string().max(200).optional(),
	recipient_email: z.string().email().optional(),
	recipient_phone: z.string().max(30).optional(),

	// Context
	reservation_id: z.string().uuid().optional(),
	context: z.record(z.string(), z.string()).optional(),

	// Idempotency
	idempotency_key: z.string().uuid().optional(),
});

export type NotificationSendCommand = z.infer<
	typeof NotificationSendCommandSchema
>;

// ─── Template CRUD Commands ──────────────────────────────────────────────────

/**
 * Create a new communication template.
 * Inserts into `communication_templates` with tenant-scoped
 * uniqueness on (tenant_id, property_id, template_code, language_code).
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const NotificationTemplateCreateCommandSchema = z.object({
	// Scope
	property_id: z.string().uuid().optional(),

	// Template Identification
	template_name: z.string().min(1).max(200),
	template_code: z.string().min(1).max(100),
	communication_type: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH_NOTIFICATION"]),

	// Classification
	category: z
		.enum([
			"BOOKING",
			"ARRIVAL",
			"STAY",
			"DEPARTURE",
			"FINANCIAL",
			"MARKETING",
			"OPERATIONAL",
			"GROUP",
		])
		.optional(),

	// Content
	subject: z.string().max(500).optional(),
	body: z.string().min(1),
	html_body: z.string().optional(),
	language_code: z.string().max(10).default("en"),
	variables: z.record(z.unknown()).optional(),

	// Automation
	is_active: z.boolean().default(true),
	is_automated: z.boolean().default(false),
	trigger_event: z.string().max(100).optional(),
	trigger_offset_hours: z.number().int().optional(),
	send_priority: z.number().int().default(0),

	// Sender
	from_name: z.string().max(200).optional(),
	from_email: z.string().email().max(255).optional(),
	from_phone: z.string().max(50).optional(),
	reply_to_email: z.string().email().max(255).optional(),
	cc_emails: z.string().max(500).optional(),
	bcc_emails: z.string().max(500).optional(),

	// Attachments & Metadata
	attachments: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type NotificationTemplateCreateCommand = z.infer<
	typeof NotificationTemplateCreateCommandSchema
>;

/**
 * Update an existing communication template.
 * Only provided fields are updated (COALESCE pattern).
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const NotificationTemplateUpdateCommandSchema = z.object({
	// Target
	template_id: z.string().uuid(),

	// Mutable Fields
	template_name: z.string().min(1).max(200).optional(),
	subject: z.string().max(500).optional(),
	body: z.string().min(1).optional(),
	html_body: z.string().optional(),
	category: z
		.enum([
			"BOOKING",
			"ARRIVAL",
			"STAY",
			"DEPARTURE",
			"FINANCIAL",
			"MARKETING",
			"OPERATIONAL",
			"GROUP",
		])
		.optional(),
	language_code: z.string().max(10).optional(),
	variables: z.record(z.unknown()).optional(),
	is_active: z.boolean().optional(),
	is_automated: z.boolean().optional(),
	trigger_event: z.string().max(100).optional(),
	trigger_offset_hours: z.number().int().optional(),
	send_priority: z.number().int().optional(),
	from_name: z.string().max(200).optional(),
	from_email: z.string().email().max(255).optional(),
	from_phone: z.string().max(50).optional(),
	reply_to_email: z.string().email().max(255).optional(),
	cc_emails: z.string().max(500).optional(),
	bcc_emails: z.string().max(500).optional(),
	attachments: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type NotificationTemplateUpdateCommand = z.infer<
	typeof NotificationTemplateUpdateCommandSchema
>;

/**
 * Soft-delete a communication template.
 * Sets is_deleted = true and records deleted_at + deleted_by.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const NotificationTemplateDeleteCommandSchema = z.object({
	template_id: z.string().uuid(),
	idempotency_key: z.string().max(120).optional(),
});

export type NotificationTemplateDeleteCommand = z.infer<
	typeof NotificationTemplateDeleteCommandSchema
>;

// ─── Automated Message Commands ──────────────────────────────────────────────

/**
 * Create a new automated message rule.
 * Configures trigger-based guest messaging with channel priority,
 * timing, targeting, frequency control, and template linkage.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const NotificationAutomatedMessageCreateCommandSchema = z.object({
	// Scope
	property_id: z.string().uuid().optional(),

	// Message Configuration
	message_name: z.string().min(1).max(200),
	message_code: z.string().min(1).max(100).optional(),
	description: z.string().max(2000).optional(),

	// Trigger
	trigger_type: z.enum([
		"booking_confirmed",
		"booking_modified",
		"booking_cancelled",
		"checkin_reminder",
		"checkin_completed",
		"checkout_reminder",
		"checkout_completed",
		"payment_received",
		"payment_failed",
		"payment_reminder",
		"review_request",
		"feedback_request",
		"birthday",
		"anniversary",
		"milestone",
		"promotion",
		"special_offer",
		"loyalty_points",
		"abandoned_cart",
		"rate_change",
		"availability_alert",
		"document_expiring",
		"reservation_expiring",
		"pre_arrival",
		"post_departure",
		"upsell_opportunity",
		"cross_sell",
		"custom",
	]),
	trigger_event: z.string().max(100).optional(),

	// Status
	is_active: z.boolean().default(true),
	priority: z.number().int().default(100),

	// Timing
	send_timing: z
		.enum(["immediate", "scheduled", "delayed", "optimal_time"])
		.default("immediate"),
	delay_minutes: z.number().int().optional(),
	delay_hours: z.number().int().optional(),
	delay_days: z.number().int().optional(),
	send_before_event_hours: z.number().int().optional(),
	send_after_event_hours: z.number().int().optional(),

	// Scheduling
	scheduled_time: z.string().max(8).optional(),
	scheduled_timezone: z.string().max(50).optional(),
	respect_quiet_hours: z.boolean().default(true),
	quiet_hours_start: z.string().max(8).optional(),
	quiet_hours_end: z.string().max(8).optional(),

	// Template Reference
	template_id: z.string().uuid().optional(),
	fallback_template_id: z.string().uuid().optional(),

	// Channel
	message_channel: z.enum([
		"email",
		"sms",
		"push",
		"whatsapp",
		"in_app",
		"voice",
		"webhook",
	]),
	secondary_channels: z
		.array(
			z.enum([
				"email",
				"sms",
				"push",
				"whatsapp",
				"in_app",
				"voice",
				"webhook",
			]),
		)
		.optional(),

	// Targeting
	target_audience: z.array(z.string().max(100)).optional(),
	conditions: z.record(z.unknown()).optional(),
	exclusion_conditions: z.record(z.unknown()).optional(),

	// Frequency Control
	max_sends_per_guest_per_day: z.number().int().optional(),
	max_sends_per_guest_per_week: z.number().int().optional(),
	max_sends_per_guest_per_month: z.number().int().optional(),
	min_hours_between_sends: z.number().int().optional(),
	respect_unsubscribe: z.boolean().default(true),

	// Compliance
	requires_consent: z.boolean().default(false),
	consent_type: z.string().max(100).optional(),
	include_unsubscribe_link: z.boolean().default(true),

	// Metadata
	metadata: z.record(z.unknown()).optional(),
	tags: z.array(z.string().max(100)).optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type NotificationAutomatedMessageCreateCommand = z.infer<
	typeof NotificationAutomatedMessageCreateCommandSchema
>;

/**
 * Update an existing automated message rule.
 * Only provided fields are updated.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const NotificationAutomatedMessageUpdateCommandSchema = z.object({
	// Target
	message_id: z.string().uuid(),

	// Mutable Fields
	message_name: z.string().min(1).max(200).optional(),
	description: z.string().max(2000).optional(),
	is_active: z.boolean().optional(),
	is_paused: z.boolean().optional(),
	priority: z.number().int().optional(),
	send_timing: z
		.enum(["immediate", "scheduled", "delayed", "optimal_time"])
		.optional(),
	delay_minutes: z.number().int().optional(),
	delay_hours: z.number().int().optional(),
	delay_days: z.number().int().optional(),
	send_before_event_hours: z.number().int().optional(),
	send_after_event_hours: z.number().int().optional(),
	scheduled_time: z.string().max(8).optional(),
	scheduled_timezone: z.string().max(50).optional(),
	respect_quiet_hours: z.boolean().optional(),
	quiet_hours_start: z.string().max(8).optional(),
	quiet_hours_end: z.string().max(8).optional(),
	template_id: z.string().uuid().optional(),
	fallback_template_id: z.string().uuid().optional(),
	message_channel: z
		.enum(["email", "sms", "push", "whatsapp", "in_app", "voice", "webhook"])
		.optional(),
	secondary_channels: z
		.array(
			z.enum([
				"email",
				"sms",
				"push",
				"whatsapp",
				"in_app",
				"voice",
				"webhook",
			]),
		)
		.optional(),
	target_audience: z.array(z.string().max(100)).optional(),
	conditions: z.record(z.unknown()).optional(),
	exclusion_conditions: z.record(z.unknown()).optional(),
	max_sends_per_guest_per_day: z.number().int().optional(),
	max_sends_per_guest_per_week: z.number().int().optional(),
	max_sends_per_guest_per_month: z.number().int().optional(),
	min_hours_between_sends: z.number().int().optional(),
	respect_unsubscribe: z.boolean().optional(),
	requires_consent: z.boolean().optional(),
	consent_type: z.string().max(100).optional(),
	include_unsubscribe_link: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	tags: z.array(z.string().max(100)).optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type NotificationAutomatedMessageUpdateCommand = z.infer<
	typeof NotificationAutomatedMessageUpdateCommandSchema
>;

/**
 * Soft-delete an automated message rule.
 * Sets is_deleted = true to disable the messaging rule.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
export const NotificationAutomatedMessageDeleteCommandSchema = z.object({
	message_id: z.string().uuid(),
	idempotency_key: z.string().max(120).optional(),
});

export type NotificationAutomatedMessageDeleteCommand = z.infer<
	typeof NotificationAutomatedMessageDeleteCommandSchema
>;
