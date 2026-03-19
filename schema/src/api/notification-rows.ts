/**
 * DEV DOC
 * Module: api/notification-rows.ts
 * Purpose: Raw PostgreSQL row shapes for notification-service query results.
 * Ownership: Schema package
 */

// =====================================================
// AUTOMATED MESSAGE ROW
// =====================================================

/** Raw row shape from automated_messages table query. */
export type AutomatedMessageRow = {
	message_id: string;
	tenant_id: string;
	property_id: string | null;
	message_name: string;
	message_code: string | null;
	description: string | null;
	trigger_type: string;
	trigger_event: string | null;
	is_active: boolean;
	is_paused: boolean;
	priority: number;
	send_timing: string;
	delay_minutes: number | null;
	delay_hours: number | null;
	delay_days: number | null;
	send_before_event_hours: number | null;
	send_after_event_hours: number | null;
	scheduled_time: string | null;
	scheduled_timezone: string | null;
	respect_quiet_hours: boolean;
	quiet_hours_start: string | null;
	quiet_hours_end: string | null;
	template_id: string | null;
	fallback_template_id: string | null;
	message_channel: string;
	secondary_channels: string[] | null;
	target_audience: string[] | null;
	conditions: Record<string, unknown> | null;
	exclusion_conditions: Record<string, unknown> | null;
	max_sends_per_guest_per_day: number | null;
	max_sends_per_guest_per_week: number | null;
	max_sends_per_guest_per_month: number | null;
	min_hours_between_sends: number | null;
	respect_unsubscribe: boolean;
	requires_consent: boolean;
	consent_type: string | null;
	include_unsubscribe_link: boolean;
	metadata: Record<string, unknown> | null;
	tags: string[] | null;
	notes: string | null;
	sent_count: number;
	created_at: Date;
	updated_at: Date;
};

// =====================================================
// TEMPLATE ROW
// =====================================================

/** Raw row shape from notification_templates table query. */
export type TemplateRow = {
	id: string;
	tenant_id: string;
	property_id: string | null;
	template_name: string;
	template_code: string;
	communication_type: string;
	category: string | null;
	subject: string | null;
	body: string;
	html_body: string | null;
	language_code: string | null;
	variables: Record<string, unknown> | null;
	is_active: boolean;
	is_automated: boolean;
	trigger_event: string | null;
	trigger_offset_hours: number | null;
	send_priority: number | null;
	from_name: string | null;
	from_email: string | null;
	from_phone: string | null;
	reply_to_email: string | null;
	cc_emails: string | null;
	bcc_emails: string | null;
	attachments: Record<string, unknown> | null;
	metadata: Record<string, unknown> | null;
	usage_count: number;
	last_used_at: Date | null;
	created_by: string | null;
	updated_by: string | null;
	created_at: Date;
	updated_at: Date;
};
