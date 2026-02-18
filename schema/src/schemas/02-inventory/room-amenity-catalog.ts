/**
 * DEV DOC
 * Module: schemas/02-inventory/room-amenity-catalog.ts
 * Description: Room Amenity Catalog Schema
 * Table: room_amenity_catalog
 * Category: 02-inventory
 * Primary exports: RoomAmenityCatalogSchema, CreateRoomAmenitySchema, UpdateRoomAmenitySchema
 * @table room_amenity_catalog
 * @category 02-inventory
 * Ownership: Schema package
 */

/**
 * Room Amenity Catalog Schema
 * @table room_amenity_catalog
 * @category 02-inventory
 * @synchronized 2025-12-25
 */

import { z } from "zod";

import {
	jsonbMetadata,
	propertyId,
	tenantId,
	uuid,
} from "../../shared/base-schemas.js";

const tagsSchema = z.array(z.string().min(1)).default([]);

export const RoomAmenityCatalogSchema = z.object({
	id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: tenantId,
	property_id: propertyId,
	amenity_code: z
		.string()
		.min(2)
		.max(80)
		.regex(/^[A-Z0-9_-]+$/, "Amenity code must be uppercase snake case"),
	display_name: z.string().min(2).max(160),
	description: z.string().max(1024).nullable().optional(),
	category: z.string().min(2).max(80).default("GENERAL"),
	icon: z.string().max(120).nullable().optional(),
	tags: tagsSchema,
	sort_order: z.number().int().default(0),
	is_default: z.boolean().default(true),
	is_active: z.boolean().default(true),
	is_required: z.boolean().default(false),
	metadata: jsonbMetadata.default({}),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().nullable().optional(),
	created_by: uuid.nullable().optional(),
	updated_by: uuid.nullable().optional(),
});

export type RoomAmenityCatalog = z.infer<typeof RoomAmenityCatalogSchema>;

export const CreateRoomAmenitySchema = RoomAmenityCatalogSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
}).extend({
	created_by: uuid.optional(),
});

export type CreateRoomAmenity = z.infer<typeof CreateRoomAmenitySchema>;

export const UpdateRoomAmenitySchema = RoomAmenityCatalogSchema.pick({
	display_name: true,
	description: true,
	category: true,
	icon: true,
	tags: true,
	sort_order: true,
	is_active: true,
	is_required: true,
	metadata: true,
})
	.partial()
	.extend({
		updated_by: uuid.optional(),
	});

export type UpdateRoomAmenity = z.infer<typeof UpdateRoomAmenitySchema>;
