/**
 * GuestDocuments Schema
 * @table guest_documents
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete GuestDocuments schema
 */
export const GuestDocumentsSchema = z.object({
	document_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	guest_id: uuid,
	reservation_id: uuid.optional(),
	document_type: z.string(),
	document_category: z.string().optional(),
	document_number: z.string().optional(),
	document_name: z.string(),
	description: z.string().optional(),
	file_path: z.string(),
	file_name: z.string(),
	file_size_bytes: z.bigint().optional(),
	file_type: z.string().optional(),
	mime_type: z.string().optional(),
	file_hash: z.string().optional(),
	issue_date: z.coerce.date().optional(),
	expiry_date: z.coerce.date().optional(),
	issuing_country: z.string().optional(),
	issuing_state: z.string().optional(),
	issuing_authority: z.string().optional(),
	is_verified: z.boolean().optional(),
	verification_status: z.string().optional(),
	verified_by: uuid.optional(),
	verified_at: z.coerce.date().optional(),
	verification_method: z.string().optional(),
	verification_notes: z.string().optional(),
	uploaded_by: uuid.optional(),
	uploaded_at: z.coerce.date().optional(),
	upload_source: z.string().optional(),
	upload_device_info: z.record(z.unknown()).optional(),
	is_encrypted: z.boolean().optional(),
	encryption_algorithm: z.string().optional(),
	encryption_key_id: z.string().optional(),
	access_level: z.string().optional(),
	requires_2fa: z.boolean().optional(),
	viewable_by_roles: z.array(z.string()).optional(),
	view_count: z.number().int().optional(),
	last_viewed_at: z.coerce.date().optional(),
	last_viewed_by: uuid.optional(),
	download_count: z.number().int().optional(),
	last_downloaded_at: z.coerce.date().optional(),
	retention_policy: z.string().optional(),
	retention_period_days: z.number().int().optional(),
	retain_until_date: z.coerce.date().optional(),
	auto_delete_after: z.coerce.date().optional(),
	legal_hold: z.boolean().optional(),
	legal_hold_reason: z.string().optional(),
	contains_pii: z.boolean().optional(),
	gdpr_category: z.string().optional(),
	processing_purpose: z.string().optional(),
	consent_obtained: z.boolean().optional(),
	consent_date: z.coerce.date().optional(),
	expiry_alert_sent: z.boolean().optional(),
	expiry_alert_date: z.coerce.date().optional(),
	days_before_expiry_alert: z.number().int().optional(),
	version: z.number().int().optional(),
	previous_version_id: uuid.optional(),
	is_latest_version: z.boolean().optional(),
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

export type GuestDocuments = z.infer<typeof GuestDocumentsSchema>;

/**
 * Schema for creating a new guest documents
 */
export const CreateGuestDocumentsSchema = GuestDocumentsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateGuestDocuments = z.infer<typeof CreateGuestDocumentsSchema>;

/**
 * Schema for updating a guest documents
 */
export const UpdateGuestDocumentsSchema = GuestDocumentsSchema.partial();

export type UpdateGuestDocuments = z.infer<typeof UpdateGuestDocumentsSchema>;
