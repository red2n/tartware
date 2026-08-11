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

export type TenantScopedListResponse = z.infer<
	typeof TenantScopedListResponseSchema
>;

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
		default_language: z.string().max(10).optional(),
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

export type TenantBootstrapResponse = z.infer<
	typeof TenantBootstrapResponseSchema
>;

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

export type SystemTenantListResponse = z.infer<
	typeof SystemTenantListResponseSchema
>;

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

export type SystemCreateTenantResponse = z.infer<
	typeof SystemCreateTenantResponseSchema
>;

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
		default_language: z.string().max(10).optional(),
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

// =====================================================
// TENANT MODULE REGISTRY TYPES
// =====================================================

/** All available tenant module IDs. */
export const MODULE_IDS = [
	"core",
	"finance-automation",
	"tenant-owner-portal",
	"facility-maintenance",
	"analytics-bi",
	"marketing-channel",
	"enterprise-api",
	// Gated commands already reference these three (revenue-management: 32
	// commands, loyalty: 4, distribution: 3). Without them here no tenant can
	// enable the module, so every one of those commands answers 403
	// COMMAND_MODULES_NOT_ENABLED and is permanently undispatchable.
	"revenue-management",
	"loyalty",
	"distribution",
] as const;

/** A valid module identifier. */
export type ModuleId = (typeof MODULE_IDS)[number];

/** Full module definition with metadata. */
export interface ModuleDefinition {
	id: ModuleId;
	name: string;
	description: string;
	tier: "base" | "add-on" | "enterprise";
	features: string[];
	category: string;
}

/** Response payload listing which modules are enabled for a tenant. */
export interface TenantModulesResponse {
	tenantId: string;
	modules: ModuleId[];
}

// =====================================================
// MODULE ACCESS REQUESTS
// =====================================================

/** Lifecycle of a staff request to have a module switched on. */
export const MODULE_REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

export const ModuleRequestStatusSchema = z.enum(MODULE_REQUEST_STATUSES);

export type ModuleRequestStatus = (typeof MODULE_REQUEST_STATUSES)[number];

/** Body for POST /v1/tenants/:tenantId/module-requests. */
export const CreateModuleRequestSchema = z.object({
	moduleId: z.enum(MODULE_IDS),
	/** Screen key the requester was blocked on — context for the reviewing admin. */
	requestedScreen: z.string().max(100).optional(),
	propertyId: z.string().uuid().optional(),
	reason: z.string().max(1000).optional(),
});

export type CreateModuleRequest = z.infer<typeof CreateModuleRequestSchema>;

/** Body for the approve/reject endpoints. */
export const ReviewModuleRequestSchema = z.object({
	notes: z.string().max(1000).optional(),
});

export type ReviewModuleRequest = z.infer<typeof ReviewModuleRequestSchema>;

/**
 * A request as the UI renders it. Names are resolved server-side so neither
 * the requester's panel nor the admin's queue has to join users or hold a copy
 * of the module registry.
 */
export interface ModuleAccessRequest {
	id: string;
	tenantId: string;
	propertyId: string | null;
	moduleId: ModuleId;
	/** Display name from the module registry, e.g. "Analytics & BI". */
	moduleName: string;
	requestedBy: string;
	requestedByName: string;
	requestedScreen: string | null;
	reason: string | null;
	status: ModuleRequestStatus;
	reviewedBy: string | null;
	reviewedByName: string | null;
	reviewedAt: string | null;
	reviewNotes: string | null;
	createdAt: string;
}

/** Response payload for the module request list endpoints. */
export interface ModuleAccessRequestListResponse {
	requests: ModuleAccessRequest[];
}
