/**
 * DEV DOC
 * Module: events/commands/compliance.ts
 * Purpose: Command schemas for compliance domain (breach reporting, notifications).
 * Ownership: Schema package
 */

import { z } from "zod";

export const ComplianceBreachReportCommandSchema = z.object({
	property_id: z.string().uuid().optional(),
	incident_title: z.string().min(1).max(300),
	incident_description: z.string().min(1).max(5000),
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
	data_categories_affected: z.array(z.string()).optional(),
	systems_affected: z.array(z.string()).optional(),
	subjects_affected_count: z.number().int().optional(),
	assigned_to: z.string().uuid().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ComplianceBreachReportCommand = z.infer<
	typeof ComplianceBreachReportCommandSchema
>;

export const ComplianceBreachNotifyCommandSchema = z.object({
	incident_id: z.string().uuid(),
	authority_reference: z.string().max(200).optional(),
	notify_subjects: z.boolean().optional(),
	notification_notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type ComplianceBreachNotifyCommand = z.infer<
	typeof ComplianceBreachNotifyCommandSchema
>;
