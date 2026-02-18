/**
 * DEV DOC
 * Module: schemas/06-integrations/ota-inventory-sync.ts
 * Description: OtaInventorySync Schema
 * Table: ota_inventory_sync
 * Category: 06-integrations
 * Primary exports: OtaInventorySyncSchema, CreateOtaInventorySyncSchema, UpdateOtaInventorySyncSchema
 * @table ota_inventory_sync
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * OtaInventorySync Schema
 * @table ota_inventory_sync
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete OtaInventorySync schema
 */
export const OtaInventorySyncSchema = z.object({
	sync_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	ota_config_id: uuid,
	channel_name: z.string(),
	sync_type: z.string(),
	sync_direction: z.string(),
	sync_status: z.string(),
	room_type_id: uuid.optional(),
	rate_plan_id: uuid.optional(),
	date_range_start: z.coerce.date().optional(),
	date_range_end: z.coerce.date().optional(),
	rooms_synced: z.number().int().optional(),
	rates_synced: z.number().int().optional(),
	restrictions_synced: z.number().int().optional(),
	total_items: z.number().int().optional(),
	successful_items: z.number().int().optional(),
	failed_items: z.number().int().optional(),
	sync_started_at: z.coerce.date().optional(),
	sync_completed_at: z.coerce.date().optional(),
	duration_seconds: z.number().int().optional(),
	next_retry_at: z.coerce.date().optional(),
	retry_count: z.number().int().optional(),
	max_retries: z.number().int().optional(),
	error_code: z.string().optional(),
	error_message: z.string().optional(),
	error_details: z.record(z.unknown()).optional(),
	validation_errors: z.record(z.unknown()).optional(),
	request_payload: z.record(z.unknown()).optional(),
	response_payload: z.record(z.unknown()).optional(),
	http_status_code: z.number().int().optional(),
	batch_id: uuid.optional(),
	batch_sequence: z.number().int().optional(),
	is_batch_complete: z.boolean().optional(),
	api_response_time_ms: z.number().int().optional(),
	processing_time_ms: z.number().int().optional(),
	items_per_second: money.optional(),
	differences_detected: z.record(z.unknown()).optional(),
	conflicts_found: z.record(z.unknown()).optional(),
	conflict_resolution: z.string().optional(),
	triggered_by: z.string().optional(),
	triggered_by_user_id: uuid.optional(),
	sync_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type OtaInventorySync = z.infer<typeof OtaInventorySyncSchema>;

/**
 * Schema for creating a new ota inventory sync
 */
export const CreateOtaInventorySyncSchema = OtaInventorySyncSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateOtaInventorySync = z.infer<
	typeof CreateOtaInventorySyncSchema
>;

/**
 * Schema for updating a ota inventory sync
 */
export const UpdateOtaInventorySyncSchema = OtaInventorySyncSchema.partial();

export type UpdateOtaInventorySync = z.infer<
	typeof UpdateOtaInventorySyncSchema
>;
