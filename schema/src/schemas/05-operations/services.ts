/**
 * Services Schema
 * @table services
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete Services schema
 */
export const ServicesSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	service_name: z.string(),
	service_code: z.string(),
	category: z.string(),
	subcategory: z.string().optional(),
	description: z.string().optional(),
	short_description: z.string().optional(),
	price: money,
	currency: z.string().optional(),
	pricing_unit: z.string().optional(),
	is_taxable: z.boolean().optional(),
	tax_rate: money.optional(),
	tax_category: z.string().optional(),
	is_available: z.boolean().optional(),
	available_days: z.record(z.unknown()).optional(),
	available_times: z.record(z.unknown()).optional(),
	requires_booking: z.boolean().optional(),
	advance_booking_hours: z.number().int().optional(),
	max_capacity: z.number().int().optional(),
	duration_minutes: z.number().int().optional(),
	commission_rate: money.optional(),
	is_active: z.boolean().optional(),
	display_order: z.number().int().optional(),
	image_url: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().optional(),
	version: z.bigint().optional(),
});

export type Services = z.infer<typeof ServicesSchema>;

/**
 * Schema for creating a new services
 */
export const CreateServicesSchema = ServicesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateServices = z.infer<typeof CreateServicesSchema>;

/**
 * Schema for updating a services
 */
export const UpdateServicesSchema = ServicesSchema.partial();

export type UpdateServices = z.infer<typeof UpdateServicesSchema>;
