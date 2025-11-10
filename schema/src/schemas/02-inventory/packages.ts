/**
 * Packages Schema
 * @table packages
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete Packages schema
 */
export const PackagesSchema = z.object({
	package_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	package_name: z.string(),
	package_code: z.string(),
	package_type: z.string(),
	short_description: z.string().optional(),
	full_description: z.string().optional(),
	marketing_description: z.string().optional(),
	terms_and_conditions: z.string().optional(),
	valid_from: z.coerce.date(),
	valid_to: z.coerce.date(),
	blackout_dates: z.array(z.coerce.date()).optional(),
	min_nights: z.number().int().optional(),
	max_nights: z.number().int().optional(),
	min_advance_booking_days: z.number().int().optional(),
	max_advance_booking_days: z.number().int().optional(),
	min_guests: z.number().int().optional(),
	max_guests: z.number().int().optional(),
	pricing_model: z.string(),
	base_price: money,
	adult_price: money.optional(),
	child_price: money.optional(),
	extra_person_charge: money.optional(),
	single_supplement: money.optional(),
	discount_percentage: money.optional(),
	commissionable: z.boolean().optional(),
	commission_percentage: money.optional(),
	available_monday: z.boolean().optional(),
	available_tuesday: z.boolean().optional(),
	available_wednesday: z.boolean().optional(),
	available_thursday: z.boolean().optional(),
	available_friday: z.boolean().optional(),
	available_saturday: z.boolean().optional(),
	available_sunday: z.boolean().optional(),
	applicable_room_types: z.array(uuid).optional(),
	all_room_types: z.boolean().optional(),
	available_channels: z.array(z.string()).optional(),
	cancellation_policy_id: uuid.optional(),
	refundable: z.boolean().optional(),
	free_cancellation_days: z.number().int().optional(),
	cancellation_fee_percentage: money.optional(),
	total_inventory: z.number().int().optional(),
	sold_count: z.number().int().optional(),
	available_inventory: z.number().int().optional(),
	includes_breakfast: z.boolean().optional(),
	includes_lunch: z.boolean().optional(),
	includes_dinner: z.boolean().optional(),
	includes_parking: z.boolean().optional(),
	includes_wifi: z.boolean().optional(),
	includes_airport_transfer: z.boolean().optional(),
	featured: z.boolean().optional(),
	display_order: z.number().int().optional(),
	image_urls: z.array(z.string()).optional(),
	highlight_color: z.string().optional(),
	badge_text: z.string().optional(),
	tags: z.array(z.string()).optional(),
	categories: z.array(z.string()).optional(),
	target_audience: z.array(z.string()).optional(),
	is_active: z.boolean().optional(),
	is_published: z.boolean().optional(),
	require_approval: z.boolean().optional(),
	total_bookings: z.number().int().optional(),
	total_revenue: money.optional(),
	average_rating: money.optional(),
	conversion_rate: money.optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	version: z.bigint().optional(),
});

export type Packages = z.infer<typeof PackagesSchema>;

/**
 * Schema for creating a new packages
 */
export const CreatePackagesSchema = PackagesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreatePackages = z.infer<typeof CreatePackagesSchema>;

/**
 * Schema for updating a packages
 */
export const UpdatePackagesSchema = PackagesSchema.partial();

export type UpdatePackages = z.infer<typeof UpdatePackagesSchema>;
