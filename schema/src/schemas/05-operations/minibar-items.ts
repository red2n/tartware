/**
 * MinibarItems Schema
 * @table minibar_items
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete MinibarItems schema
 */
export const MinibarItemsSchema = z.object({
	item_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	item_code: z.string(),
	item_name: z.string(),
	item_description: z.string().optional(),
	brand: z.string().optional(),
	manufacturer: z.string().optional(),
	category: z.string(),
	subcategory: z.string().optional(),
	package_size: z.string().optional(),
	unit_of_measure: z.string().optional(),
	units_per_package: z.number().int().optional(),
	is_alcoholic: z.boolean().optional(),
	alcohol_content_percent: money.optional(),
	requires_age_verification: z.boolean().optional(),
	minimum_age: z.number().int().optional(),
	base_price: money,
	cost_price: money.optional(),
	currency_code: z.string().optional(),
	tax_category: z.string().optional(),
	tax_rate: money.optional(),
	service_charge_applicable: z.boolean().optional(),
	pricing_tiers: z.record(z.unknown()).optional(),
	track_inventory: z.boolean().optional(),
	current_stock_quantity: z.number().int().optional(),
	par_level_per_room: z.number().int().optional(),
	reorder_point: z.number().int().optional(),
	reorder_quantity: z.number().int().optional(),
	storage_location: z.string().optional(),
	supplier_name: z.string().optional(),
	supplier_sku: z.string().optional(),
	supplier_id: uuid.optional(),
	lead_time_days: z.number().int().optional(),
	barcode: z.string().optional(),
	barcode_type: z.string().optional(),
	image_url: z.string().optional(),
	thumbnail_url: z.string().optional(),
	product_url: z.string().optional(),
	calories: z.number().int().optional(),
	serving_size: z.string().optional(),
	ingredients: z.string().optional(),
	nutritional_info: z.record(z.unknown()).optional(),
	contains_allergens: z.boolean().optional(),
	allergen_list: z.array(z.string()).optional(),
	is_vegetarian: z.boolean().optional(),
	is_vegan: z.boolean().optional(),
	is_gluten_free: z.boolean().optional(),
	is_kosher: z.boolean().optional(),
	is_halal: z.boolean().optional(),
	dietary_flags: z.record(z.unknown()).optional(),
	storage_temp_required: z.string().optional(),
	min_storage_temp_celsius: money.optional(),
	max_storage_temp_celsius: money.optional(),
	shelf_life_days: z.number().int().optional(),
	expiration_tracking_required: z.boolean().optional(),
	is_active: z.boolean().optional(),
	available_from_date: z.coerce.date().optional(),
	available_to_date: z.coerce.date().optional(),
	seasonal: z.boolean().optional(),
	season: z.string().optional(),
	display_order: z.number().int().optional(),
	featured: z.boolean().optional(),
	promotional_text: z.string().optional(),
	upsell_item: z.boolean().optional(),
	related_items: z.array(uuid).optional(),
	requires_health_warning: z.boolean().optional(),
	health_warning_text: z.string().optional(),
	country_of_origin: z.string().optional(),
	restricted_countries: z.array(z.string()).optional(),
	revenue_category: z.string().optional(),
	profit_margin_percent: money.optional(),
	popularity_score: z.number().int().optional(),
	pos_item_id: z.string().optional(),
	accounting_code: z.string().optional(),
	gl_account: z.string().optional(),
	internal_notes: z.string().optional(),
	supplier_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type MinibarItems = z.infer<typeof MinibarItemsSchema>;

/**
 * Schema for creating a new minibar items
 */
export const CreateMinibarItemsSchema = MinibarItemsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateMinibarItems = z.infer<typeof CreateMinibarItemsSchema>;

/**
 * Schema for updating a minibar items
 */
export const UpdateMinibarItemsSchema = MinibarItemsSchema.partial();

export type UpdateMinibarItems = z.infer<typeof UpdateMinibarItemsSchema>;
