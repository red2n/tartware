/**
 * DEV DOC
 * Module: schemas/07-analytics/gdpr-consent-logs.ts
 * Description: GdprConsentLogs Schema
 * Table: gdpr_consent_logs
 * Category: 07-analytics
 * Primary exports: GdprConsentLogsSchema, CreateGdprConsentLogsSchema, UpdateGdprConsentLogsSchema
 * @table gdpr_consent_logs
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * GdprConsentLogs Schema
 * @table gdpr_consent_logs
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete GdprConsentLogs schema
 */
export const GdprConsentLogsSchema = z.object({
	consent_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	subject_type: z.string().optional(),
	subject_id: uuid,
	subject_email: z.string().optional(),
	subject_name: z.string().optional(),
	consent_type: z.string(),
	consent_category: z.string().optional(),
	consent_given: z.boolean(),
	consent_status: z.string().optional(),
	consent_date: z.coerce.date(),
	expiry_date: z.coerce.date().optional(),
	withdrawal_date: z.coerce.date().optional(),
	is_active: z.boolean().optional(),
	consent_method: z.string().optional(),
	consent_source: z.string().optional(),
	consent_source_url: z.string().optional(),
	ip_address: z.string().optional(),
	user_agent: z.string().optional(),
	purpose_description: z.string(),
	legal_basis: z.string().optional(),
	data_categories: z.array(z.string()).optional(),
	processing_purposes: z.array(z.string()).optional(),
	shared_with_third_parties: z.boolean().optional(),
	third_party_names: z.array(z.string()).optional(),
	third_party_purposes: z.string().optional(),
	data_transfer_outside_eu: z.boolean().optional(),
	transfer_countries: z.array(z.string()).optional(),
	safeguards_applied: z.string().optional(),
	retention_period: z.string().optional(),
	retention_end_date: z.coerce.date().optional(),
	right_to_access_exercised: z.boolean().optional(),
	right_to_rectification_exercised: z.boolean().optional(),
	right_to_erasure_exercised: z.boolean().optional(),
	right_to_restrict_exercised: z.boolean().optional(),
	right_to_portability_exercised: z.boolean().optional(),
	right_to_object_exercised: z.boolean().optional(),
	consent_version: z.string().optional(),
	policy_version: z.string().optional(),
	terms_version: z.string().optional(),
	previous_consent_id: uuid.optional(),
	superseded_by_consent_id: uuid.optional(),
	withdrawn_by: z.string().optional(),
	withdrawal_method: z.string().optional(),
	withdrawal_reason: z.string().optional(),
	renewal_required: z.boolean().optional(),
	renewal_reminder_sent: z.boolean().optional(),
	renewal_reminder_date: z.coerce.date().optional(),
	consent_proof_url: z.string().optional(),
	consent_document_url: z.string().optional(),
	recorded_by: uuid.optional(),
	verified_by: uuid.optional(),
	verified_at: z.coerce.date().optional(),
	gdpr_compliant: z.boolean().optional(),
	ccpa_compliant: z.boolean().optional(),
	compliance_notes: z.string().optional(),
	dpo_reviewed: z.boolean().optional(),
	dpo_reviewed_by: uuid.optional(),
	dpo_review_date: z.coerce.date().optional(),
	dpo_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type GdprConsentLogs = z.infer<typeof GdprConsentLogsSchema>;

/**
 * Schema for creating a new gdpr consent logs
 */
export const CreateGdprConsentLogsSchema = GdprConsentLogsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateGdprConsentLogs = z.infer<typeof CreateGdprConsentLogsSchema>;

/**
 * Schema for updating a gdpr consent logs
 */
export const UpdateGdprConsentLogsSchema = GdprConsentLogsSchema.partial();

export type UpdateGdprConsentLogs = z.infer<typeof UpdateGdprConsentLogsSchema>;
