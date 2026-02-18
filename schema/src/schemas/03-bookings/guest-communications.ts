/**
 * DEV DOC
 * Module: schemas/03-bookings/guest-communications.ts
 * Description: Guest communication log — records every outbound message (email, SMS, push, WhatsApp)
 *   sent to a guest, linking back to the template used, reservation context, and delivery tracking
 *   (queued → sent → delivered → opened → clicked / failed).
 * Table: guest_communications
 * Category: 03-bookings
 * Primary exports: GuestCommunicationsSchema, CreateGuestCommunicationsSchema, UpdateGuestCommunicationsSchema
 * @table guest_communications
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Communication delivery log for guest notifications.
 * Each row tracks one outbound message through its lifecycle
 * from creation to delivery/failure, with full engagement tracking.
 *
 * @table guest_communications
 * @category 03-bookings
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

// ─── Full Row Schema ─────────────────────────────────────────────────────────

/**
 * Complete guest_communications row including delivery tracking timestamps,
 * external provider IDs, and audit fields.
 */
export const GuestCommunicationsSchema = z.object({
	id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid,
	guest_id: uuid,
	reservation_id: uuid.optional(),
	template_id: uuid.optional(),
	communication_type: z.string(),
	direction: z.string(),
	subject: z.string().optional(),
	message: z.string(),
	sender_name: z.string().optional(),
	sender_email: z.string().optional(),
	sender_phone: z.string().optional(),
	recipient_name: z.string().optional(),
	recipient_email: z.string().optional(),
	recipient_phone: z.string().optional(),
	status: z.string().optional(),
	external_message_id: z.string().optional(),
	sent_at: z.coerce.date().optional(),
	delivered_at: z.coerce.date().optional(),
	opened_at: z.coerce.date().optional(),
	clicked_at: z.coerce.date().optional(),
	failed_at: z.coerce.date().optional(),
	failure_reason: z.string().optional(),
	attachments: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
	created_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
});

export type GuestCommunications = z.infer<typeof GuestCommunicationsSchema>;

// ─── Create / Update Schemas ─────────────────────────────────────────────────

/**
 * Schema for creating a new guest communication record.
 * Omits system-generated id, delivery tracking timestamps, and soft-delete flags.
 */
export const CreateGuestCommunicationsSchema = GuestCommunicationsSchema.omit({
	id: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
	external_message_id: true,
	sent_at: true,
	delivered_at: true,
	opened_at: true,
	clicked_at: true,
	failed_at: true,
	failure_reason: true,
	created_at: true,
	updated_at: true,
});

export type CreateGuestCommunications = z.infer<
	typeof CreateGuestCommunicationsSchema
>;

/**
 * Schema for updating a guest communication record.
 * Restricts to delivery status and tracking fields only.
 */
export const UpdateGuestCommunicationsSchema = GuestCommunicationsSchema.pick({
	status: true,
	external_message_id: true,
	sent_at: true,
	delivered_at: true,
	opened_at: true,
	clicked_at: true,
	failed_at: true,
	failure_reason: true,
	attachments: true,
	metadata: true,
}).partial();

export type UpdateGuestCommunications = z.infer<
	typeof UpdateGuestCommunicationsSchema
>;
