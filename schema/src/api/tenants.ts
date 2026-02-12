/**
 * DEV DOC
 * Module: api/tenants.ts
 * Purpose: Tenant CRUD and self-serve bootstrap API schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { TenantWithRelationsSchema } from "../schemas/01-core/tenants.js";
import { uuid } from "../shared/base-schemas.js";
import { TenantTypeEnum } from "../shared/enums.js";

// -----------------------------------------------------------------------------
// Tenant List
// -----------------------------------------------------------------------------

/** Query schema for listing tenants (tenant-scoped). */
export const TenantListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).default(50),
	offset: z.coerce.number().int().nonnegative().default(0),
});

export type TenantListQuery = z.infer<typeof TenantListQuerySchema>;

/** Tenant list response (tenant-scoped). */
export const TenantScopedListResponseSchema = z.object({
	tenants: z.array(
		TenantWithRelationsSchema.extend({
			version: z.string(),
		}),
	),
	count: z.number().int().nonnegative(),
	limit: z.number().int().positive(),
	offset: z.number().int().nonnegative(),
});

export type TenantScopedListResponse = z.infer<typeof TenantScopedListResponseSchema>;

// -----------------------------------------------------------------------------
// Self-Serve Bootstrap
// -----------------------------------------------------------------------------

/** Address sub-schema for property creation. */
export const PropertyAddressSchema = z.object({
	line1: z.string().optional(),
	line2: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	postal_code: z.string().optional(),
	country: z.string().optional(),
});

export type PropertyAddress = z.infer<typeof PropertyAddressSchema>;

/** Self-serve tenant bootstrap request body. */
export const TenantBootstrapSchema = z.object({
	tenant: z.object({
		name: z.string().min(1).max(200),
		slug: z
			.string()
			.min(1)
			.max(100)
			.regex(/^[a-z0-9-]+$/)
			.optional(),
		type: TenantTypeEnum.default("INDEPENDENT"),
		email: z.string().email(),
		phone: z.string().optional(),
		website: z.string().url().optional(),
	}),
	property: z.object({
		property_name: z.string().min(1).max(200),
		property_code: z.string().min(1).max(50).optional(),
		property_type: z.string().optional(),
		star_rating: z.number().min(0).max(5).optional(),
		total_rooms: z.number().int().nonnegative().optional(),
		phone: z.string().optional(),
		email: z.string().email().optional(),
		website: z.string().url().optional(),
		address: PropertyAddressSchema.optional(),
		currency: z.string().length(3).optional(),
		timezone: z.string().optional(),
	}),
	owner: z.object({
		username: z.string().min(3).max(50),
		email: z.string().email(),
		password: z.string().min(8),
		first_name: z.string().min(1).max(100),
		last_name: z.string().min(1).max(100),
		phone: z.string().optional(),
	}),
});

export type TenantBootstrap = z.infer<typeof TenantBootstrapSchema>;

/** Self-serve tenant bootstrap response. */
export const TenantBootstrapResponseSchema = z.object({
	tenant: z.object({
		id: uuid,
		name: z.string(),
		slug: z.string(),
	}),
	property: z.object({
		id: uuid,
		property_name: z.string(),
		property_code: z.string(),
	}),
	owner: z.object({
		id: uuid,
		username: z.string(),
		email: z.string().email(),
	}),
	message: z.string(),
});

export type TenantBootstrapResponse = z.infer<typeof TenantBootstrapResponseSchema>;

// -----------------------------------------------------------------------------
// System Tenant List
// -----------------------------------------------------------------------------

/** Query schema for system admin tenant listing. */
export const SystemTenantListQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(200).default(50),
	offset: z.coerce.number().int().nonnegative().default(0),
});

export type SystemTenantListQuery = z.infer<typeof SystemTenantListQuerySchema>;

/** System tenant list response. */
export const SystemTenantListResponseSchema = z.object({
	tenants: z.array(
		TenantWithRelationsSchema.extend({
			version: z.string(),
		}),
	),
	count: z.number().int().nonnegative(),
	limit: z.number().int().positive(),
	offset: z.number().int().nonnegative(),
});

export type SystemTenantListResponse = z.infer<typeof SystemTenantListResponseSchema>;

// -----------------------------------------------------------------------------
// System Tenant Create (simple)
// -----------------------------------------------------------------------------

/** System admin create-tenant request body. */
export const SystemCreateTenantSchema = z.object({
	name: z.string().min(1).max(200),
	slug: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9-]+$/),
	type: TenantTypeEnum.default("INDEPENDENT"),
	email: z.string().email(),
	phone: z.string().optional(),
	website: z.string().url().optional(),
});

export type SystemCreateTenant = z.infer<typeof SystemCreateTenantSchema>;

/** System admin create-tenant response. */
export const SystemCreateTenantResponseSchema = z.object({
	id: uuid,
	name: z.string(),
	slug: z.string(),
	message: z.string(),
});

export type SystemCreateTenantResponse = z.infer<typeof SystemCreateTenantResponseSchema>;

// -----------------------------------------------------------------------------
// System Bootstrap (admin-initiated)
// -----------------------------------------------------------------------------

/** System admin bootstrap request body. */
export const SystemBootstrapTenantSchema = z.object({
	tenant: SystemCreateTenantSchema,
	property: z.object({
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
	}),
	owner: z.object({
		username: z.string().min(3).max(50),
		email: z.string().email(),
		password: z.string().min(8),
		first_name: z.string().min(1).max(100),
		last_name: z.string().min(1).max(100),
		phone: z.string().optional(),
	}),
});

export type SystemBootstrapTenant = z.infer<typeof SystemBootstrapTenantSchema>;


