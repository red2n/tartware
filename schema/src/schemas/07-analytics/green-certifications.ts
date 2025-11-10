/**
 * GreenCertifications Schema
 * @table green_certifications
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete GreenCertifications schema
 */
export const GreenCertificationsSchema = z.object({
	certification_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	certification_name: z.string(),
	certification_body: z.string(),
	certification_level: z.string().optional(),
	certification_type: z.string().optional(),
	status: z.string(),
	application_date: z.coerce.date().optional(),
	certification_date: z.coerce.date().optional(),
	expiry_date: z.coerce.date().optional(),
	recertification_due_date: z.coerce.date().optional(),
	total_requirements: z.number().int().optional(),
	completed_requirements: z.number().int().optional(),
	completion_percentage: money.optional(),
	points_earned: z.number().int().optional(),
	points_required: z.number().int().optional(),
	points_possible: z.number().int().optional(),
	certificate_number: z.string().optional(),
	certificate_url: z.string().optional(),
	audit_report_url: z.string().optional(),
	application_fee: money.optional(),
	annual_fee: money.optional(),
	audit_fee: money.optional(),
	total_investment: money.optional(),
	marketing_value: z.string().optional(),
	cost_savings_realized: money.optional(),
	next_audit_date: z.coerce.date().optional(),
	audit_frequency: z.string().optional(),
	last_audit_score: money.optional(),
	pending_requirements: z.record(z.unknown()).optional(),
	completed_requirements_details: z.record(z.unknown()).optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type GreenCertifications = z.infer<typeof GreenCertificationsSchema>;

/**
 * Schema for creating a new green certifications
 */
export const CreateGreenCertificationsSchema = GreenCertificationsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateGreenCertifications = z.infer<
	typeof CreateGreenCertificationsSchema
>;

/**
 * Schema for updating a green certifications
 */
export const UpdateGreenCertificationsSchema =
	GreenCertificationsSchema.partial();

export type UpdateGreenCertifications = z.infer<
	typeof UpdateGreenCertificationsSchema
>;
