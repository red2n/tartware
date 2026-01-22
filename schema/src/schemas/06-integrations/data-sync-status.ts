/**
 * DEV DOC
 * Module: schemas/06-integrations/data-sync-status.ts
 * Description: DataSyncStatus Schema
 * Table: data_sync_status
 * Category: 06-integrations
 * Primary exports: DataSyncStatusSchema, CreateDataSyncStatusSchema, UpdateDataSyncStatusSchema
 * @table data_sync_status
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * DataSyncStatus Schema
 * @table data_sync_status
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete DataSyncStatus schema
 */
export const DataSyncStatusSchema = z.object({
	sync_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	sync_name: z.string(),
	sync_type: z.string(),
	entity_type: z.string(),
	status: z.string().optional(),
	started_at: z.coerce.date().optional(),
	completed_at: z.coerce.date().optional(),
	duration_seconds: z.number().int().optional(),
	records_total: z.number().int().optional(),
	records_processed: z.number().int().optional(),
	records_succeeded: z.number().int().optional(),
	records_failed: z.number().int().optional(),
	records_skipped: z.number().int().optional(),
	error_message: z.string().optional(),
	error_details: z.record(z.unknown()).optional(),
	sync_config: z.record(z.unknown()).optional(),
	sync_results: z.record(z.unknown()).optional(),
	next_sync_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type DataSyncStatus = z.infer<typeof DataSyncStatusSchema>;

/**
 * Schema for creating a new data sync status
 */
export const CreateDataSyncStatusSchema = DataSyncStatusSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateDataSyncStatus = z.infer<typeof CreateDataSyncStatusSchema>;

/**
 * Schema for updating a data sync status
 */
export const UpdateDataSyncStatusSchema = DataSyncStatusSchema.partial();

export type UpdateDataSyncStatus = z.infer<typeof UpdateDataSyncStatusSchema>;
