/**
 * Tenant Schema - Multi-tenant root entity
 * @table tenants
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from "zod";

import {
	uuid,
	email,
	phoneNumber,
	url,
	countryCode,
	taxId,
	auditTimestamps,
	softDelete,
	jsonbMetadata,
	nonEmptyString,
} from "../../shared/base-schemas.js";
import { TenantTypeEnum, TenantStatusEnum } from "../../shared/enums.js";

/**
 * Tenant configuration JSONB schema
 */
export const TenantConfigSchema = z.object({
	features: z.array(z.string()).default(["reservations", "payments"]),
	maxUsers: z.number().int().positive().default(10),
	maxProperties: z.number().int().positive().default(5),
	defaultCurrency: z.string().length(3).default("USD"),
	defaultLanguage: z.string().length(2).default("en"),
	defaultTimezone: z.string().default("UTC"),
	enableMultiProperty: z.boolean().default(true),
	enableChannelManager: z.boolean().default(false),
	enableLoyaltyProgram: z.boolean().default(false),
	enableAdvancedReporting: z.boolean().default(false),
	enablePaymentProcessing: z.boolean().default(true),
	brandingEnabled: z.boolean().default(true),
}).passthrough();

/**
 * Tenant subscription JSONB schema
 */
export const TenantSubscriptionSchema = z.object({
	plan: z.enum(["FREE", "BASIC", "PROFESSIONAL", "ENTERPRISE"]).default("FREE"),
	amount: z.number().nonnegative().default(0),
	currency: z.string().length(3).default("USD"),
	billingCycle: z.enum(["MONTHLY", "YEARLY", "ONE_TIME"]).default("MONTHLY"),
	startDate: z.coerce.date().optional(),
	endDate: z.coerce.date().optional(),
	trialEndDate: z.coerce.date().optional(),
}).passthrough();

/**
 * Complete Tenant schema
 */
export const TenantSchema = z.object({
	id: uuid.describe("Primary key"),
	name: nonEmptyString.max(200).describe("Tenant organization name"),
	slug: nonEmptyString
		.max(200)
		.regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
		.describe("URL-friendly identifier"),
	type: TenantTypeEnum.describe("Organization type"),
	status: TenantStatusEnum.default("TRIAL").describe("Subscription status"),
	email: email.describe("Primary contact email"),
	phone: phoneNumber.optional().describe("Contact phone number"),
	website: url.optional().describe("Organization website"),
	address_line1: z.string().max(255).optional(),
	address_line2: z.string().max(255).optional(),
	city: z.string().max(100).optional(),
	state: z.string().max(100).optional(),
	postal_code: z.string().max(20).optional(),
	country: countryCode.optional().describe("ISO 3166-1 alpha-2 country code"),
	tax_id: taxId.optional().describe("Tax identification number"),
	business_license: z.string().max(100).optional(),
	registration_number: z.string().max(100).optional(),
	config: TenantConfigSchema.describe("Tenant configuration settings"),
	subscription: TenantSubscriptionSchema.describe("Subscription details"),
	metadata: jsonbMetadata,
	...auditTimestamps,
	...softDelete,
	version: z.bigint().default(BigInt(0)).describe("Optimistic locking version"),
});

export type Tenant = z.infer<typeof TenantSchema>;

/**
 * Schema for creating a new tenant (excludes auto-generated fields)
 */
export const CreateTenantSchema = TenantSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	deleted_at: true,
	version: true,
}).extend({
	status: TenantStatusEnum.default("TRIAL"),
});

export type CreateTenant = z.infer<typeof CreateTenantSchema>;

/**
 * Schema for updating an existing tenant (all fields optional except id)
 */
export const UpdateTenantSchema = TenantSchema.omit({
	id: true,
	created_at: true,
	created_by: true,
	deleted_at: true,
})
	.partial()
	.extend({
		id: uuid,
	});

export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;

/**
 * Tenant with relationships (for API responses and UI)
 */
export const TenantWithRelationsSchema = TenantSchema.extend({
	property_count: z.number().int().nonnegative().optional(),
	user_count: z.number().int().nonnegative().optional(),
	active_properties: z.number().int().nonnegative().optional(),
});

export type TenantWithRelations = z.infer<typeof TenantWithRelationsSchema>;
