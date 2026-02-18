/**
 * DEV DOC
 * Module: schemas/01-core/property-feature-flags.ts
 * Description: PropertyFeatureFlags Schema - Property-level feature toggles
 * Table: property_feature_flags
 * Category: 01-core
 * Primary exports: PropertyFeatureFlagsSchema, CreatePropertyFeatureFlagsSchema, UpdatePropertyFeatureFlagsSchema
 * @table property_feature_flags
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * PropertyFeatureFlags Schema
 * Enable/disable PMS features at the property level.
 * Used for phased rollouts, tiered subscriptions,
 * and property-specific customization.
 *
 * @table property_feature_flags
 * @category 01-core
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const PropertyFeatureFlagsSchema = z.object({
	// Primary Key
	flag_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid.optional().nullable(),

	// Feature Identification
	feature_code: z.string().min(1).max(100),
	feature_name: z.string().min(1).max(200),
	feature_description: z.string().optional().nullable(),

	// Classification
	feature_module: z.string().max(50),

	// State
	is_enabled: z.boolean().default(false),
	enabled_at: z.coerce.date().optional().nullable(),
	enabled_by: uuid.optional().nullable(),
	disabled_at: z.coerce.date().optional().nullable(),
	disabled_by: uuid.optional().nullable(),

	// Rollout Control
	rollout_percentage: z.number().int().min(0).max(100).default(100),
	rollout_strategy: z.string().max(20).default("ALL"),
	allowed_roles: z.array(z.string()).optional().nullable(),
	allowed_user_ids: z.array(uuid).optional().nullable(),

	// Subscription
	requires_subscription_tier: z.string().max(20).optional().nullable(),
	is_premium: z.boolean().default(false),
	is_beta: z.boolean().default(false),

	// Dependencies
	depends_on: z.array(z.string()).optional().nullable(),
	conflicts_with: z.array(z.string()).optional().nullable(),

	// Configuration
	config: z.record(z.unknown()).optional(),

	// Notes
	internal_notes: z.string().optional().nullable(),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),
});

export type PropertyFeatureFlags = z.infer<typeof PropertyFeatureFlagsSchema>;

export const CreatePropertyFeatureFlagsSchema =
	PropertyFeatureFlagsSchema.omit({
		flag_id: true,
		created_at: true,
		updated_at: true,
		enabled_at: true,
		disabled_at: true,
	});

export type CreatePropertyFeatureFlags = z.infer<
	typeof CreatePropertyFeatureFlagsSchema
>;

export const UpdatePropertyFeatureFlagsSchema =
	PropertyFeatureFlagsSchema.partial().omit({
		flag_id: true,
		tenant_id: true,
		created_at: true,
		created_by: true,
	});

export type UpdatePropertyFeatureFlags = z.infer<
	typeof UpdatePropertyFeatureFlagsSchema
>;
