/**
 * DEV DOC
 * Module: schemas/04-financial/comp-property-config.ts
 * Description: CompPropertyConfig Schema - Per-property comp configuration
 * Table: comp_property_config
 * Category: 04-financial
 * Primary exports: CompPropertyConfigSchema, CreateCompPropertyConfigSchema, UpdateCompPropertyConfigSchema
 * @table comp_property_config
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * CompPropertyConfig Schema
 * Per-property configuration for comp accounting including
 * GL accounts, tax rules, and budget thresholds.
 *
 * @table comp_property_config
 * @category 04-financial
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

export const CompPropertyConfigSchema = z.object({
	// Primary Key
	config_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Enable/Disable
	comp_accounting_enabled: z.boolean().default(false),

	// Tax Configuration
	comp_tax_exempt: z.boolean().default(false),
	comp_tax_rate: z.number().optional().nullable(),

	// Default GL Accounts
	default_comp_offset_account: z.string().max(50).optional().nullable(),
	room_comp_account: z.string().max(50).optional().nullable(),
	fb_comp_account: z.string().max(50).optional().nullable(),
	spa_comp_account: z.string().max(50).optional().nullable(),
	other_comp_account: z.string().max(50).optional().nullable(),

	// Approval Rules
	require_reason_code: z.boolean().default(true),
	require_authorization_code: z.boolean().default(false),
	auto_post_below_amount: money.optional().nullable(),

	// Reporting
	daily_comp_report_enabled: z.boolean().default(true),
	daily_comp_report_recipients: z.array(z.string()).optional().nullable(),
	comp_budget_monthly: z.number().optional().nullable(),
	comp_budget_alert_percent: z.number().default(80.0),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),
});

export type CompPropertyConfig = z.infer<typeof CompPropertyConfigSchema>;

export const CreateCompPropertyConfigSchema = CompPropertyConfigSchema.omit({
	config_id: true,
	created_at: true,
	updated_at: true,
});

export type CreateCompPropertyConfig = z.infer<
	typeof CreateCompPropertyConfigSchema
>;

export const UpdateCompPropertyConfigSchema =
	CompPropertyConfigSchema.partial().omit({
		config_id: true,
		tenant_id: true,
		property_id: true,
		created_at: true,
		created_by: true,
	});

export type UpdateCompPropertyConfig = z.infer<
	typeof UpdateCompPropertyConfigSchema
>;
