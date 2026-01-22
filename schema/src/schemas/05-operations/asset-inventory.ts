/**
 * DEV DOC
 * Module: schemas/05-operations/asset-inventory.ts
 * Description: AssetInventory Schema
 * Table: asset_inventory
 * Category: 05-operations
 * Primary exports: AssetInventorySchema, CreateAssetInventorySchema, UpdateAssetInventorySchema
 * @table asset_inventory
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * AssetInventory Schema
 * @table asset_inventory
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete AssetInventory schema
 */
export const AssetInventorySchema = z.object({
	asset_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	asset_tag: z.string(),
	asset_name: z.string(),
	asset_type: z.string(),
	asset_category: z.string().optional(),
	location_type: z.string().optional(),
	room_id: uuid.optional(),
	location_description: z.string().optional(),
	manufacturer: z.string().optional(),
	model_number: z.string().optional(),
	serial_number: z.string().optional(),
	barcode: z.string().optional(),
	purchase_date: z.coerce.date().optional(),
	purchase_price: money.optional(),
	vendor_name: z.string().optional(),
	vendor_contact: z.string().optional(),
	invoice_number: z.string().optional(),
	purchase_order_number: z.string().optional(),
	warranty_start_date: z.coerce.date().optional(),
	warranty_end_date: z.coerce.date().optional(),
	warranty_provider: z.string().optional(),
	warranty_terms: z.string().optional(),
	warranty_status: z.string().optional(),
	depreciation_method: z.string().optional(),
	useful_life_years: z.number().int().optional(),
	salvage_value: money.optional(),
	current_book_value: money.optional(),
	condition: z.string().optional(),
	last_inspection_date: z.coerce.date().optional(),
	next_inspection_date: z.coerce.date().optional(),
	inspection_frequency_days: z.number().int().optional(),
	maintenance_schedule: z.string().optional(),
	last_maintenance_date: z.coerce.date().optional(),
	next_maintenance_date: z.coerce.date().optional(),
	last_maintenance_cost: money.optional(),
	total_maintenance_cost: money.optional(),
	maintenance_notes: z.string().optional(),
	uptime_percentage: money.optional(),
	failure_count: z.number().int().optional(),
	mean_time_between_failures: z.number().int().optional(),
	mean_time_to_repair: z.number().int().optional(),
	energy_consumption_kwh: money.optional(),
	energy_efficiency_rating: z.string().optional(),
	is_critical: z.boolean().optional(),
	criticality_level: z.string().optional(),
	status: z.string().optional(),
	operational_status: z.string().optional(),
	insured: z.boolean().optional(),
	insurance_policy_number: z.string().optional(),
	insurance_value: money.optional(),
	requires_certification: z.boolean().optional(),
	certification_number: z.string().optional(),
	certification_expiry_date: z.coerce.date().optional(),
	iot_enabled: z.boolean().optional(),
	smart_device_id: uuid.optional(),
	sensor_data_available: z.boolean().optional(),
	disposal_date: z.coerce.date().optional(),
	disposal_method: z.string().optional(),
	disposal_value: money.optional(),
	disposal_notes: z.string().optional(),
	manual_url: z.string().optional(),
	specification_url: z.string().optional(),
	photo_urls: z.array(z.string()).optional(),
	notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type AssetInventory = z.infer<typeof AssetInventorySchema>;

/**
 * Schema for creating a new asset inventory
 */
export const CreateAssetInventorySchema = AssetInventorySchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAssetInventory = z.infer<typeof CreateAssetInventorySchema>;

/**
 * Schema for updating a asset inventory
 */
export const UpdateAssetInventorySchema = AssetInventorySchema.partial();

export type UpdateAssetInventory = z.infer<typeof UpdateAssetInventorySchema>;
