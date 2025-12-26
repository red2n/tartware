/**
 * ContractAgreements Schema
 * @table contract_agreements
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete ContractAgreements schema
 */
export const ContractAgreementsSchema = z.object({
	agreement_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	agreement_number: z.string(),
	agreement_title: z.string(),
	agreement_description: z.string().optional(),
	agreement_type: z.string().optional(),
	agreement_category: z.string().optional(),
	party_a_type: z.string().optional(),
	party_a_name: z.string(),
	party_a_representative: z.string().optional(),
	party_a_contact: z.string().optional(),
	party_b_type: z.string().optional(),
	party_b_name: z.string(),
	party_b_representative: z.string().optional(),
	party_b_contact: z.string().optional(),
	additional_parties: z.record(z.unknown()).optional(),
	agreement_status: z.string().optional(),
	is_active: z.boolean().optional(),
	effective_date: z.coerce.date(),
	expiry_date: z.coerce.date().optional(),
	term_length_months: z.number().int().optional(),
	signed_date: z.coerce.date().optional(),
	execution_date: z.coerce.date().optional(),
	has_financial_terms: z.boolean().optional(),
	contract_value: money.optional(),
	currency: z.string().optional(),
	payment_terms: z.string().optional(),
	payment_schedule: z.string().optional(),
	party_a_obligations: z.string().optional(),
	party_b_obligations: z.string().optional(),
	key_obligations: z.record(z.unknown()).optional(),
	has_performance_metrics: z.boolean().optional(),
	performance_metrics: z.record(z.unknown()).optional(),
	performance_reviews_required: z.boolean().optional(),
	review_frequency: z.string().optional(),
	auto_renewal: z.boolean().optional(),
	renewal_notice_days: z.number().int().optional(),
	renewal_date: z.coerce.date().optional(),
	renewal_terms: z.string().optional(),
	renegotiation_required: z.boolean().optional(),
	termination_clause: z.string().optional(),
	termination_notice_days: z.number().int().optional(),
	early_termination_allowed: z.boolean().optional(),
	early_termination_penalty: money.optional(),
	terminated: z.boolean().optional(),
	termination_date: z.coerce.date().optional(),
	termination_reason: z.string().optional(),
	terminated_by: uuid.optional(),
	has_nda: z.boolean().optional(),
	nda_terms: z.string().optional(),
	confidentiality_period_years: z.number().int().optional(),
	liability_cap: money.optional(),
	indemnification_clause: z.string().optional(),
	insurance_requirements: z.string().optional(),
	insurance_required: z.boolean().optional(),
	insurance_amount: money.optional(),
	insurance_verified: z.boolean().optional(),
	dispute_resolution_method: z.string().optional(),
	governing_law: z.string().optional(),
	jurisdiction: z.string().optional(),
	arbitration_location: z.string().optional(),
	breach_reported: z.boolean().optional(),
	breach_date: z.coerce.date().optional(),
	breach_description: z.string().optional(),
	breach_remedy: z.string().optional(),
	amendment_count: z.number().int().optional(),
	amendments: z.record(z.unknown()).optional(),
	legal_review_required: z.boolean().optional(),
	legal_reviewed: z.boolean().optional(),
	legal_reviewed_by: uuid.optional(),
	legal_review_date: z.coerce.date().optional(),
	legal_review_notes: z.string().optional(),
	requires_approval: z.boolean().optional(),
	approval_level: z.string().optional(),
	approved: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	approval_notes: z.string().optional(),
	requires_signature: z.boolean().optional(),
	party_a_signed: z.boolean().optional(),
	party_a_signed_by: z.string().optional(),
	party_a_signed_date: z.coerce.date().optional(),
	party_b_signed: z.boolean().optional(),
	party_b_signed_by: z.string().optional(),
	party_b_signed_date: z.coerce.date().optional(),
	fully_executed: z.boolean().optional(),
	execution_complete_date: z.coerce.date().optional(),
	draft_document_url: z.string().optional(),
	final_document_url: z.string().optional(),
	signed_document_url: z.string().optional(),
	has_attachments: z.boolean().optional(),
	attachment_urls: z.array(z.string()).optional(),
	compliance_requirements: z.string().optional(),
	regulatory_filing_required: z.boolean().optional(),
	regulatory_filed: z.boolean().optional(),
	filing_reference: z.string().optional(),
	milestone_tracking: z.boolean().optional(),
	milestones: z.record(z.unknown()).optional(),
	obligations_met: z.boolean().optional(),
	compliance_status: z.string().optional(),
	alert_before_expiry_days: z.number().int().optional(),
	expiry_alert_sent: z.boolean().optional(),
	renewal_reminder_sent: z.boolean().optional(),
	renewal_reminder_date: z.coerce.date().optional(),
	parent_agreement_id: uuid.optional(),
	supersedes_agreement_id: uuid.optional(),
	superseded_by_agreement_id: uuid.optional(),
	related_agreements: z.array(uuid).optional(),
	metadata: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type ContractAgreements = z.infer<typeof ContractAgreementsSchema>;

/**
 * Schema for creating a new contract agreements
 */
export const CreateContractAgreementsSchema = ContractAgreementsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateContractAgreements = z.infer<
	typeof CreateContractAgreementsSchema
>;

/**
 * Schema for updating a contract agreements
 */
export const UpdateContractAgreementsSchema =
	ContractAgreementsSchema.partial();

export type UpdateContractAgreements = z.infer<
	typeof UpdateContractAgreementsSchema
>;
