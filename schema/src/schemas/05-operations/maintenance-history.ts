/**
 * DEV DOC
 * Module: schemas/05-operations/maintenance-history.ts
 * Description: MaintenanceHistory Schema
 * Table: maintenance_history
 * Category: 05-operations
 * Primary exports: MaintenanceHistorySchema, CreateMaintenanceHistorySchema, UpdateMaintenanceHistorySchema
 * @table maintenance_history
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * MaintenanceHistory Schema
 * @table maintenance_history
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete MaintenanceHistory schema
 */
export const MaintenanceHistorySchema = z.object({
	maintenance_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	asset_id: uuid,
	maintenance_type: z.string(),
	work_order_number: z.string().optional(),
	maintenance_date: z.coerce.date(),
	start_time: z.string().optional(),
	end_time: z.string().optional(),
	duration_hours: money.optional(),
	issue_description: z.string().optional(),
	issue_severity: z.string().optional(),
	work_performed: z.string(),
	parts_replaced: z.array(z.string()).optional(),
	performed_by: z.string().optional(),
	technician_id: uuid.optional(),
	vendor_name: z.string().optional(),
	vendor_technician_name: z.string().optional(),
	labor_cost: money.optional(),
	parts_cost: money.optional(),
	total_cost: money.optional(),
	covered_by_warranty: z.boolean().optional(),
	issue_resolved: z.boolean().optional(),
	follow_up_required: z.boolean().optional(),
	follow_up_date: z.coerce.date().optional(),
	follow_up_notes: z.string().optional(),
	quality_check_performed: z.boolean().optional(),
	quality_check_passed: z.boolean().optional(),
	quality_notes: z.string().optional(),
	asset_downtime_hours: money.optional(),
	guest_impact: z.boolean().optional(),
	before_photos: z.array(z.string()).optional(),
	after_photos: z.array(z.string()).optional(),
	documentation_urls: z.array(z.string()).optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type MaintenanceHistory = z.infer<typeof MaintenanceHistorySchema>;

/**
 * Schema for creating a new maintenance history
 */
export const CreateMaintenanceHistorySchema = MaintenanceHistorySchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateMaintenanceHistory = z.infer<
	typeof CreateMaintenanceHistorySchema
>;

/**
 * Schema for updating a maintenance history
 */
export const UpdateMaintenanceHistorySchema =
	MaintenanceHistorySchema.partial();

export type UpdateMaintenanceHistory = z.infer<
	typeof UpdateMaintenanceHistorySchema
>;
