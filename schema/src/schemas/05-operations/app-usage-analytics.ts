/**
 * DEV DOC
 * Module: schemas/05-operations/app-usage-analytics.ts
 * Description: AppUsageAnalytics Schema
 * Table: app_usage_analytics
 * Category: 05-operations
 * Primary exports: AppUsageAnalyticsSchema, CreateAppUsageAnalyticsSchema, UpdateAppUsageAnalyticsSchema
 * @table app_usage_analytics
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * AppUsageAnalytics Schema
 * @table app_usage_analytics
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete AppUsageAnalytics schema
 */
export const AppUsageAnalyticsSchema = z.object({
	event_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	guest_id: uuid.optional(),
	session_id: z.string().optional(),
	device_id: z.string().optional(),
	platform: z.string().optional(),
	app_version: z.string().optional(),
	os_version: z.string().optional(),
	event_type: z.string().optional(),
	event_name: z.string().optional(),
	screen_name: z.string().optional(),
	event_timestamp: z.coerce.date().optional(),
	duration_seconds: z.number().int().optional(),
	event_data: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	is_deleted: z.boolean().optional(),
});

export type AppUsageAnalytics = z.infer<typeof AppUsageAnalyticsSchema>;

/**
 * Schema for creating a new app usage analytics
 */
export const CreateAppUsageAnalyticsSchema = AppUsageAnalyticsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAppUsageAnalytics = z.infer<
	typeof CreateAppUsageAnalyticsSchema
>;

/**
 * Schema for updating a app usage analytics
 */
export const UpdateAppUsageAnalyticsSchema = AppUsageAnalyticsSchema.partial();

export type UpdateAppUsageAnalytics = z.infer<
	typeof UpdateAppUsageAnalyticsSchema
>;
