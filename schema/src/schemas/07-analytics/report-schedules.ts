/**
 * DEV DOC
 * Module: schemas/07-analytics/report-schedules.ts
 * Description: ReportSchedules Schema
 * Table: report_schedules
 * Category: 07-analytics
 * Primary exports: ReportSchedulesSchema, CreateReportSchedulesSchema, UpdateReportSchedulesSchema
 * @table report_schedules
 * @category 07-analytics
 * Ownership: Schema package
 */

/**
 * ReportSchedules Schema
 * @table report_schedules
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete ReportSchedules schema
 */
export const ReportSchedulesSchema = z.object({
	schedule_id: uuid,
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	report_type: z.string(),
	schedule_expression: z.string(),
	is_active: z.boolean().optional(),
	last_run: z.coerce.date().optional(),
	next_run: z.coerce.date().optional(),
	recipients: z.array(z.string()).optional(),
	config: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
});

export type ReportSchedules = z.infer<typeof ReportSchedulesSchema>;

/**
 * Schema for creating a new report schedules
 */
export const CreateReportSchedulesSchema = ReportSchedulesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateReportSchedules = z.infer<typeof CreateReportSchedulesSchema>;

/**
 * Schema for updating a report schedules
 */
export const UpdateReportSchedulesSchema = ReportSchedulesSchema.partial();

export type UpdateReportSchedules = z.infer<typeof UpdateReportSchedulesSchema>;
