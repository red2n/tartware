/**
 * DEV DOC
 * Module: events/commands/compliance.ts
 * Description: Compliance command schemas for data breach reporting and notification
 * Primary exports: ComplianceBreachReportCommandSchema, ComplianceBreachNotifyCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

/**
 * Report a data breach or security incident.
 * Creates an incident record with severity classification,
 * affected data categories, and systems for regulatory tracking.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
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

/**
 * Notify authorities and affected data subjects about a breach.
 * Triggers regulatory notifications and optional subject alerts
 * per GDPR/privacy requirements.
 *
 * @category commands
 * @synchronized 2026-02-18
 */
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
