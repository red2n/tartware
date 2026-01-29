/**
 * DEV DOC
 * Module: api/amenities.ts
 * Purpose: Amenity API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

/**
 * Amenity list item schema for API responses.
 * Uses camelCase for API consistency.
 */
export const AmenityListItemSchema = z.object({
	id: uuid,
	tenantId: uuid,
	propertyId: uuid,
	amenityCode: z.string(),
	displayName: z.string(),
	description: z.string().optional(),
	category: z.string(),
	icon: z.string().optional(),
	tags: z.array(z.string()).default([]),
	sortOrder: z.number().int(),
	isDefault: z.boolean(),
	isActive: z.boolean(),
	isRequired: z.boolean(),
	metadata: z.record(z.unknown()).default({}),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().optional(),
	createdBy: uuid.optional(),
	updatedBy: uuid.optional(),
});

export type AmenityListItem = z.infer<typeof AmenityListItemSchema>;

/**
 * Create amenity request body schema.
 */
export const CreateAmenityBodySchema = z.object({
	amenityCode: z
		.string()
		.min(2)
		.max(80)
		.regex(/^[A-Za-z0-9_-]+$/, {
			message: "Amenity code must be alphanumeric (with _ or -)",
		}),
	displayName: z.string().min(2).max(160),
	description: z.string().max(1024).optional(),
	category: z.string().max(80).optional(),
	icon: z.string().max(120).optional(),
	tags: z.array(z.string().max(80)).optional(),
	sortOrder: z.number().int().min(0).optional(),
	isDefault: z.boolean().optional(),
	isActive: z.boolean().optional(),
	isRequired: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type CreateAmenityBody = z.infer<typeof CreateAmenityBodySchema>;

/**
 * Update amenity request body schema.
 */
export const UpdateAmenityBodySchema = CreateAmenityBodySchema.partial().omit({
	amenityCode: true,
	isDefault: true,
});

export type UpdateAmenityBody = z.infer<typeof UpdateAmenityBodySchema>;

/**
 * Amenity list response schema.
 */
export const AmenityListResponseSchema = z.object({
	data: z.array(AmenityListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type AmenityListResponse = z.infer<typeof AmenityListResponseSchema>;

/**
 * Single amenity response schema.
 */
export const AmenityResponseSchema = z.object({
	data: AmenityListItemSchema,
});

export type AmenityResponse = z.infer<typeof AmenityResponseSchema>;
