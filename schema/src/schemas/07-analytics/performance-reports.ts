/**
 * PerformanceReports Schema
 * @table performance_reports
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete PerformanceReports schema
 */
export const PerformanceReportsSchema = z.object({
	report_id: uuid,
	report_type: z.string(),
	report_name: z.string(),
	report_data: z.record(z.unknown()),
	severity: z.string().optional(),
	status: z.string().optional(),
	generated_at: z.coerce.date().optional(),
	sent_at: z.coerce.date().optional(),
	recipients: z.array(z.string()).optional(),
});

export type PerformanceReports = z.infer<typeof PerformanceReportsSchema>;

/**
 * Schema for creating a new performance reports
 */
export const CreatePerformanceReportsSchema = PerformanceReportsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreatePerformanceReports = z.infer<
	typeof CreatePerformanceReportsSchema
>;

/**
 * Schema for updating a performance reports
 */
export const UpdatePerformanceReportsSchema =
	PerformanceReportsSchema.partial();

export type UpdatePerformanceReports = z.infer<
	typeof UpdatePerformanceReportsSchema
>;
