/**
 * DEV DOC
 * Module: schemas/07-analytics/police-reports.ts
 * Description: PoliceReports Schema
 * Table: police_reports
 * Category: 07-analytics
 * Primary exports: PoliceReportsSchema, CreatePoliceReportsSchema, UpdatePoliceReportsSchema
 * @table police_reports
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * PoliceReports Schema
 * @table police_reports
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete PoliceReports schema
 */
export const PoliceReportsSchema = z.object({
	report_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	report_number: z.string(),
	police_case_number: z.string().optional(),
	police_report_number: z.string().optional(),
	incident_id: uuid.optional(),
	incident_report_id: uuid.optional(),
	incident_date: z.coerce.date(),
	incident_time: z.string().optional(),
	reported_date: z.coerce.date(),
	reported_time: z.string().optional(),
	incident_type: z.string().optional(),
	incident_description: z.string(),
	incident_location: z.string().optional(),
	room_id: uuid.optional(),
	room_number: z.string().optional(),
	agency_name: z.string(),
	agency_jurisdiction: z.string().optional(),
	agency_contact_number: z.string().optional(),
	agency_email: z.string().optional(),
	responding_officer_name: z.string().optional(),
	responding_officer_badge: z.string().optional(),
	responding_officer_contact: z.string().optional(),
	additional_officers: z.record(z.unknown()).optional(),
	report_status: z.string().optional(),
	suspect_count: z.number().int().optional(),
	suspects: z.record(z.unknown()).optional(),
	victim_count: z.number().int().optional(),
	victims: z.record(z.unknown()).optional(),
	witness_count: z.number().int().optional(),
	witnesses: z.record(z.unknown()).optional(),
	guest_involved: z.boolean().optional(),
	guest_ids: z.array(uuid).optional(),
	staff_involved: z.boolean().optional(),
	staff_ids: z.array(uuid).optional(),
	property_stolen: z.boolean().optional(),
	stolen_items: z.record(z.unknown()).optional(),
	total_loss_value: money.optional(),
	property_damaged: z.boolean().optional(),
	damage_description: z.string().optional(),
	damage_value: money.optional(),
	evidence_collected: z.boolean().optional(),
	evidence_items: z.record(z.unknown()).optional(),
	evidence_tags: z.array(z.string()).optional(),
	medical_response_required: z.boolean().optional(),
	ambulance_called: z.boolean().optional(),
	hospital_transport: z.boolean().optional(),
	hospital_name: z.string().optional(),
	injuries_reported: z.boolean().optional(),
	injury_details: z.string().optional(),
	arrests_made: z.boolean().optional(),
	arrest_count: z.number().int().optional(),
	arrested_persons: z.record(z.unknown()).optional(),
	investigation_ongoing: z.boolean().optional(),
	lead_investigator_name: z.string().optional(),
	lead_investigator_contact: z.string().optional(),
	follow_up_required: z.boolean().optional(),
	follow_up_date: z.coerce.date().optional(),
	follow_up_notes: z.string().optional(),
	court_case_filed: z.boolean().optional(),
	court_case_number: z.string().optional(),
	court_date: z.coerce.date().optional(),
	court_jurisdiction: z.string().optional(),
	charges_filed: z.array(z.string()).optional(),
	hotel_action_taken: z.string().optional(),
	guest_evicted: z.boolean().optional(),
	guest_banned: z.boolean().optional(),
	security_measures_enhanced: z.boolean().optional(),
	security_enhancements: z.string().optional(),
	insurance_claim_filed: z.boolean().optional(),
	insurance_claim_number: z.string().optional(),
	insurance_company: z.string().optional(),
	police_report_copy_url: z.string().optional(),
	photos_urls: z.array(z.string()).optional(),
	video_evidence_urls: z.array(z.string()).optional(),
	has_documentation: z.boolean().optional(),
	documentation_urls: z.array(z.string()).optional(),
	management_notified: z.boolean().optional(),
	management_notified_at: z.coerce.date().optional(),
	corporate_notified: z.boolean().optional(),
	legal_counsel_notified: z.boolean().optional(),
	confidential: z.boolean().optional(),
	restricted_access: z.boolean().optional(),
	authorized_viewers: z.array(uuid).optional(),
	resolved: z.boolean().optional(),
	resolution_date: z.coerce.date().optional(),
	resolution_description: z.string().optional(),
	outcome: z.string().optional(),
	related_report_ids: z.array(uuid).optional(),
	parent_report_id: uuid.optional(),
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

export type PoliceReports = z.infer<typeof PoliceReportsSchema>;

/**
 * Schema for creating a new police reports
 */
export const CreatePoliceReportsSchema = PoliceReportsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreatePoliceReports = z.infer<typeof CreatePoliceReportsSchema>;

/**
 * Schema for updating a police reports
 */
export const UpdatePoliceReportsSchema = PoliceReportsSchema.partial();

export type UpdatePoliceReports = z.infer<typeof UpdatePoliceReportsSchema>;
