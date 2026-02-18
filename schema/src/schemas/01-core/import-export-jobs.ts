/**
 * DEV DOC
 * Module: schemas/01-core/import-export-jobs.ts
 * Description: ImportExportJobs Schema
 * Table: import_export_jobs
 * Category: 01-core
 * Primary exports: ImportExportJobsSchema, CreateImportExportJobsSchema, UpdateImportExportJobsSchema
 * @table import_export_jobs
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * ImportExportJobs Schema — async bulk import/export job tracking
 * with progress, error logging, and downloadable results.
 * @table import_export_jobs
 * @category 01-core
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

const jobTypeEnum = z.enum(["IMPORT", "EXPORT"]);

const entityTypeEnum = z.enum([
	"PROPERTY",
	"ROOM",
	"GUEST",
	"RESERVATION",
	"HOUSEKEEPING_SERVICE",
	"COMPANY",
	"TRAVEL_AGENT",
	"RATE",
	"AR_ACCOUNT",
]);

const jobStatusEnum = z.enum([
	"PENDING",
	"VALIDATING",
	"PROCESSING",
	"COMPLETED",
	"FAILED",
	"CANCELLED",
]);

const fileFormatEnum = z.enum(["CSV", "XLSX", "JSON", "XML"]);

/**
 * Complete ImportExportJobs schema
 */
export const ImportExportJobsSchema = z.object({
	job_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),

	// Job type
	job_type: jobTypeEnum,
	entity_type: entityTypeEnum,
	job_label: z.string().max(200).optional(),

	// File information
	source_file_name: z.string().max(500).optional(),
	source_file_format: fileFormatEnum.optional(),
	source_file_size_bytes: z.number().int().optional(),
	source_file_url: z.string().max(1000).optional(),
	result_file_url: z.string().max(1000).optional(),

	// Status
	status: jobStatusEnum.optional(),

	// Progress
	total_records: z.number().int().optional(),
	processed_records: z.number().int().optional(),
	success_count: z.number().int().optional(),
	error_count: z.number().int().optional(),
	warning_count: z.number().int().optional(),
	skipped_count: z.number().int().optional(),

	// Errors
	error_summary: z.string().optional(),
	error_details: z.array(z.record(z.unknown())).optional(),

	// Mapping & options
	column_mapping: z.record(z.string()).optional(),
	import_options: z.record(z.unknown()).optional(),
	export_options: z.record(z.unknown()).optional(),

	// Timing
	started_at: z.coerce.date().optional(),
	completed_at: z.coerce.date().optional(),
	duration_ms: z.number().int().optional(),

	// Initiator
	initiated_by: uuid.optional(),

	// Audit
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),

	// Soft delete
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type ImportExportJobs = z.infer<typeof ImportExportJobsSchema>;

/**
 * Schema for creating an import/export job.
 * Omits auto-generated and progress fields.
 */
export const CreateImportExportJobsSchema = ImportExportJobsSchema.omit({
	job_id: true,
	status: true,
	processed_records: true,
	success_count: true,
	error_count: true,
	warning_count: true,
	skipped_count: true,
	error_summary: true,
	error_details: true,
	result_file_url: true,
	started_at: true,
	completed_at: true,
	duration_ms: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
});

export type CreateImportExportJobs = z.infer<
	typeof CreateImportExportJobsSchema
>;

/**
 * Schema for updating an import/export job (progress, status, errors).
 * Identity and type fields are immutable.
 */
export const UpdateImportExportJobsSchema = ImportExportJobsSchema.omit({
	job_id: true,
	tenant_id: true,
	job_type: true,
	entity_type: true,
	created_at: true,
	created_by: true,
}).partial();

export type UpdateImportExportJobs = z.infer<
	typeof UpdateImportExportJobsSchema
>;
