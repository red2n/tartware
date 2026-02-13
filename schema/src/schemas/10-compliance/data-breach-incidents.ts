/**
 * DEV DOC
 * Module: schemas/10-compliance/data-breach-incidents.ts
 * Description: DataBreachIncidents Schema
 * Table: data_breach_incidents
 * Category: 10-compliance
 * Primary exports: DataBreachIncidentsSchema, CreateDataBreachIncidentsSchema, UpdateDataBreachIncidentsSchema
 * @table data_breach_incidents
 * @category 10-compliance
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const DataBreachIncidentsSchema = z.object({
	incident_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	incident_title: z.string().min(1).max(300),
	incident_description: z.string().min(1),
	severity: z.enum(["low", "medium", "high", "critical"]),
	breach_type: z.enum([
		"unauthorized_access",
		"data_loss",
		"data_theft",
		"system_compromise",
		"phishing",
		"insider_threat",
		"ransomware",
		"accidental_disclosure",
		"other",
	]),
	discovered_at: z.coerce.date(),
	occurred_at: z.coerce.date().optional(),
	contained_at: z.coerce.date().optional(),
	resolved_at: z.coerce.date().optional(),
	notification_deadline: z.coerce.date().optional(),
	authority_notified: z.boolean().optional(),
	authority_notified_at: z.coerce.date().optional(),
	authority_reference: z.string().max(200).optional(),
	subjects_notified: z.boolean().optional(),
	subjects_notified_at: z.coerce.date().optional(),
	subjects_affected_count: z.number().int().optional(),
	status: z.enum([
		"reported",
		"investigating",
		"contained",
		"notifying",
		"remediated",
		"closed",
		"escalated",
	]),
	data_categories_affected: z.array(z.string()).optional(),
	systems_affected: z.array(z.string()).optional(),
	reported_by: uuid.optional(),
	assigned_to: uuid.optional(),
	remediation_steps: z.string().optional(),
	root_cause: z.string().optional(),
	preventive_measures: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
});

export type DataBreachIncidents = z.infer<typeof DataBreachIncidentsSchema>;

export const CreateDataBreachIncidentsSchema = DataBreachIncidentsSchema.omit({
	incident_id: true,
	notification_deadline: true,
	authority_notified: true,
	authority_notified_at: true,
	authority_reference: true,
	subjects_notified: true,
	subjects_notified_at: true,
	contained_at: true,
	resolved_at: true,
	created_at: true,
	updated_at: true,
});

export type CreateDataBreachIncidents = z.infer<typeof CreateDataBreachIncidentsSchema>;

export const UpdateDataBreachIncidentsSchema = DataBreachIncidentsSchema.partial().required({
	incident_id: true,
});

export type UpdateDataBreachIncidents = z.infer<typeof UpdateDataBreachIncidentsSchema>;
