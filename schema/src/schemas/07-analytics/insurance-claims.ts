/**
 * InsuranceClaims Schema
 * @table insurance_claims
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete InsuranceClaims schema
 */
export const InsuranceClaimsSchema = z.object({
	claim_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	claim_number: z.string(),
	insurance_claim_number: z.string().optional(),
	policy_number: z.string(),
	claim_type: z.string().optional(),
	claim_category: z.string().optional(),
	insurance_company: z.string(),
	insurance_policy_type: z.string().optional(),
	policy_effective_date: z.coerce.date().optional(),
	policy_expiry_date: z.coerce.date().optional(),
	insurance_agent_name: z.string().optional(),
	insurance_agent_contact: z.string().optional(),
	insurance_agent_email: z.string().optional(),
	incident_date: z.coerce.date(),
	incident_time: z.string().optional(),
	incident_description: z.string(),
	incident_location: z.string().optional(),
	incident_report_id: uuid.optional(),
	police_report_id: uuid.optional(),
	room_id: uuid.optional(),
	room_number: z.string().optional(),
	claim_status: z.string().optional(),
	claim_filed_date: z.coerce.date(),
	claim_received_date: z.coerce.date().optional(),
	investigation_started_date: z.coerce.date().optional(),
	decision_date: z.coerce.date().optional(),
	settlement_date: z.coerce.date().optional(),
	closure_date: z.coerce.date().optional(),
	claimant_type: z.string().optional(),
	claimant_name: z.string().optional(),
	claimant_contact: z.string().optional(),
	claimant_address: z.string().optional(),
	guest_id: uuid.optional(),
	employee_id: uuid.optional(),
	claim_amount: money,
	currency: z.string().optional(),
	deductible_amount: money.optional(),
	coverage_limit: money.optional(),
	approved_amount: money.optional(),
	settlement_amount: money.optional(),
	payment_received: money.optional(),
	outstanding_amount: money.optional(),
	loss_type: z.string().optional(),
	loss_description: z.string().optional(),
	cause_of_loss: z.string().optional(),
	property_damaged: z.string().optional(),
	estimated_repair_cost: money.optional(),
	actual_repair_cost: money.optional(),
	injuries_reported: z.boolean().optional(),
	injury_description: z.string().optional(),
	medical_treatment_required: z.boolean().optional(),
	medical_costs: money.optional(),
	business_interruption: z.boolean().optional(),
	interruption_start_date: z.coerce.date().optional(),
	interruption_end_date: z.coerce.date().optional(),
	lost_revenue: money.optional(),
	investigation_required: z.boolean().optional(),
	investigator_name: z.string().optional(),
	investigator_company: z.string().optional(),
	investigator_contact: z.string().optional(),
	investigation_findings: z.string().optional(),
	investigation_report_url: z.string().optional(),
	liability_admitted: z.boolean().optional(),
	liability_percentage: money.optional(),
	third_party_liability: z.boolean().optional(),
	third_party_details: z.string().optional(),
	adjuster_assigned: z.boolean().optional(),
	adjuster_name: z.string().optional(),
	adjuster_contact: z.string().optional(),
	adjuster_visit_date: z.coerce.date().optional(),
	adjuster_report_url: z.string().optional(),
	documentation_complete: z.boolean().optional(),
	required_documents: z.array(z.string()).optional(),
	submitted_documents: z.array(z.string()).optional(),
	photos_submitted: z.number().int().optional(),
	photo_urls: z.array(z.string()).optional(),
	repair_estimates_count: z.number().int().optional(),
	repair_estimate_urls: z.array(z.string()).optional(),
	invoices_submitted: z.number().int().optional(),
	invoice_urls: z.array(z.string()).optional(),
	witness_statements_collected: z.boolean().optional(),
	witness_count: z.number().int().optional(),
	witnesses: z.record(z.unknown()).optional(),
	denied: z.boolean().optional(),
	denial_reason: z.string().optional(),
	denial_date: z.coerce.date().optional(),
	appealed: z.boolean().optional(),
	appeal_submitted_date: z.coerce.date().optional(),
	appeal_outcome: z.string().optional(),
	appeal_notes: z.string().optional(),
	settlement_offered: z.boolean().optional(),
	settlement_offer_amount: money.optional(),
	settlement_offer_date: z.coerce.date().optional(),
	settlement_accepted: z.boolean().optional(),
	settlement_accepted_date: z.coerce.date().optional(),
	settlement_terms: z.string().optional(),
	payment_method: z.string().optional(),
	payment_reference: z.string().optional(),
	payment_date: z.coerce.date().optional(),
	payment_received_by: uuid.optional(),
	payment_schedule: z.record(z.unknown()).optional(),
	subrogation_potential: z.boolean().optional(),
	subrogation_amount: money.optional(),
	subrogation_pursued: z.boolean().optional(),
	subrogation_recovered: money.optional(),
	legal_action_required: z.boolean().optional(),
	lawyer_assigned: z.string().optional(),
	legal_case_number: z.string().optional(),
	legal_notes: z.string().optional(),
	insurer_notified: z.boolean().optional(),
	insurer_notification_date: z.coerce.date().optional(),
	management_notified: z.boolean().optional(),
	corporate_notified: z.boolean().optional(),
	internal_review_required: z.boolean().optional(),
	reviewed_by: uuid.optional(),
	review_date: z.coerce.date().optional(),
	review_notes: z.string().optional(),
	requires_approval: z.boolean().optional(),
	approved_by: uuid.optional(),
	approval_date: z.coerce.date().optional(),
	follow_up_required: z.boolean().optional(),
	follow_up_date: z.coerce.date().optional(),
	follow_up_notes: z.string().optional(),
	related_claim_ids: z.array(uuid).optional(),
	parent_claim_id: uuid.optional(),
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

export type InsuranceClaims = z.infer<typeof InsuranceClaimsSchema>;

/**
 * Schema for creating a new insurance claims
 */
export const CreateInsuranceClaimsSchema = InsuranceClaimsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateInsuranceClaims = z.infer<typeof CreateInsuranceClaimsSchema>;

/**
 * Schema for updating a insurance claims
 */
export const UpdateInsuranceClaimsSchema = InsuranceClaimsSchema.partial();

export type UpdateInsuranceClaims = z.infer<typeof UpdateInsuranceClaimsSchema>;
