/**
 * CommunicationTemplates Schema
 * @table communication_templates
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete CommunicationTemplates schema
 */
export const CommunicationTemplatesSchema = z.object({
	id: uuid,
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

/**
 * Schema for creating a new communication templates
 */
export const CreateCommunicationTemplatesSchema =
	CommunicationTemplatesSchema.omit({
		// TODO: Add fields to omit for creation
	});

export type CreateCommunicationTemplates = z.infer<
	typeof CreateCommunicationTemplatesSchema
>;

/**
 * Schema for updating a communication templates
 */
export const UpdateCommunicationTemplatesSchema =
	CommunicationTemplatesSchema.partial();

export type UpdateCommunicationTemplates = z.infer<
	typeof UpdateCommunicationTemplatesSchema
>;
