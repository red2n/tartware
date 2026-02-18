/**
 * DEV DOC
 * Module: schemas/03-bookings/communication-templates.ts
 * Description: Guest communication templates — reusable message blueprints (email, SMS, WhatsApp, push)
 *   with {{variable}} placeholders for personalized guest notifications. Supports per-property overrides,
 *   multi-language variants, trigger-based automation, and sender configuration.
 * Table: communication_templates
 * Category: 03-bookings
 * Primary exports: CommunicationTemplatesSchema, CreateCommunicationTemplatesSchema, UpdateCommunicationTemplatesSchema
 * @table communication_templates
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Reusable notification templates with {{variable}} rendering.
 * Scoped by (tenant_id, property_id, template_code, language_code) unique constraint.
 * Used by notification-service for both manual and automated guest outreach.
 *
 * @table communication_templates
 * @category 03-bookings
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

// ─── Full Row Schema ─────────────────────────────────────────────────────────

/**
 * Complete communication_templates row including system-managed usage tracking,
 * audit timestamps, and soft-delete flags.
 */
export const CommunicationTemplatesSchema = z.object({
	id: uuid,
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid.optional(),
	template_name: z.string(),
	template_code: z.string(),
	communication_type: z.string(),
	category: z.string().optional(),
	subject: z.string().optional(),
	body: z.string(),
	html_body: z.string().optional(),
	language_code: z.string().optional(),
	variables: z.record(z.unknown()).optional(),
	is_active: z.boolean().optional(),
	is_automated: z.boolean().optional(),
	trigger_event: z.string().optional(),
	trigger_offset_hours: z.number().int().optional(),
	send_priority: z.number().int().optional(),
	from_name: z.string().optional(),
	from_email: z.string().optional(),
	from_phone: z.string().optional(),
	reply_to_email: z.string().optional(),
	cc_emails: z.string().optional(),
	bcc_emails: z.string().optional(),
	attachments: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
	usage_count: z.number().int().optional(),
	last_used_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
});

export type CommunicationTemplates = z.infer<
	typeof CommunicationTemplatesSchema
>;

// ─── Create / Update Schemas ─────────────────────────────────────────────────

/**
 * Schema for creating a new communication template.
 * Omits system-generated id, usage tracking, audit timestamps, and soft-delete flags.
 */
export const CreateCommunicationTemplatesSchema =
	CommunicationTemplatesSchema.omit({
		id: true,
		usage_count: true,
		last_used_at: true,
		created_by: true,
		updated_by: true,
		created_at: true,
		updated_at: true,
		is_deleted: true,
		deleted_at: true,
		deleted_by: true,
	});

export type CreateCommunicationTemplates = z.infer<
	typeof CreateCommunicationTemplatesSchema
>;

/**
 * Schema for updating a communication template.
 * Restricts to user-mutable content and configuration fields only.
 */
export const UpdateCommunicationTemplatesSchema =
	CommunicationTemplatesSchema.pick({
		template_name: true,
		subject: true,
		body: true,
		html_body: true,
		category: true,
		language_code: true,
		variables: true,
		is_active: true,
		is_automated: true,
		trigger_event: true,
		trigger_offset_hours: true,
		send_priority: true,
		from_name: true,
		from_email: true,
		from_phone: true,
		reply_to_email: true,
		cc_emails: true,
		bcc_emails: true,
		attachments: true,
		metadata: true,
	}).partial();

export type UpdateCommunicationTemplates = z.infer<
	typeof UpdateCommunicationTemplatesSchema
>;
