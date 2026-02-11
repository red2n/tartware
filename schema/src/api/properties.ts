/**
 * DEV DOC
 * Module: api/properties.ts
 * Purpose: Property CRUD API schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { PropertyWithStatsSchema } from "../schemas/01-core/properties.js";
import { uuid } from "../shared/base-schemas.js";

import { PropertyAddressSchema } from "./tenants.js";

// -----------------------------------------------------------------------------
// Query
// -----------------------------------------------------------------------------

/** Query schema for listing properties for a tenant. */
export const PropertyListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0),
	tenant_id: uuid,
});

export type PropertyListQuery = z.infer<typeof PropertyListQuerySchema>;

/** Property list response (version serialized as string). */
export const PropertyListResponseSchema = z.array(
	PropertyWithStatsSchema.omit({ version: true }).extend({
		version: z.string(),
	}),
);

export type PropertyListResponse = z.infer<typeof PropertyListResponseSchema>;

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------

/** Body schema for creating a property via API. */
export const CreatePropertyBodySchema = z.object({
	tenant_id: uuid,
	property_name: z.string().min(1).max(200),
	property_code: z.string().min(1).max(50),
	property_type: z.string().optional(),
	star_rating: z.number().min(0).max(5).optional(),
	total_rooms: z.number().int().nonnegative().optional(),
	phone: z.string().optional(),
	email: z.string().email().optional(),
	website: z.string().url().optional(),
	address: PropertyAddressSchema.optional(),
	currency: z.string().length(3).optional(),
	timezone: z.string().optional(),
});

export type CreatePropertyBody = z.infer<typeof CreatePropertyBodySchema>;

/** Response after creating a property. */
export const CreatePropertyResponseSchema = z.object({
	id: uuid,
	property_name: z.string(),
	property_code: z.string(),
	message: z.string(),
});

export type CreatePropertyResponse = z.infer<typeof CreatePropertyResponseSchema>;
