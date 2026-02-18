/**
 * DEV DOC
 * Module: events/commands/settings.ts
 * Description: Settings command schemas for value set, bulk set, approval, and reversion across tenant/property/user scopes
 * Primary exports: SettingsValueSetCommandSchema, SettingsValueBulkSetCommandSchema, SettingsValueApproveCommandSchema, SettingsValueRevertCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

import { SettingsScopeEnum } from "../../shared/enums.js";

const SettingsValuePayloadSchema = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.array(z.union([z.string(), z.number(), z.boolean()])),
	z.record(z.unknown()),
]);

export const SettingsValueSetCommandSchema = z.object({
	setting_id: z.string().uuid(),
	scope_level: SettingsScopeEnum,
	value: SettingsValuePayloadSchema.or(z.null()),
	property_id: z.string().uuid().optional(),
	unit_id: z.string().uuid().optional(),
	user_id: z.string().uuid().optional(),
	notes: z.string().max(1024).optional(),
	context: z.record(z.unknown()).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type SettingsValueSetCommand = z.infer<
	typeof SettingsValueSetCommandSchema
>;

const SettingsValueSetEntrySchema = SettingsValueSetCommandSchema.omit({
	idempotency_key: true,
});

export const SettingsValueBulkSetCommandSchema = z.object({
	entries: z.array(SettingsValueSetEntrySchema).min(1),
	notes: z.string().max(1024).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type SettingsValueBulkSetCommand = z.infer<
	typeof SettingsValueBulkSetCommandSchema
>;

export const SettingsValueApproveCommandSchema = z.object({
	setting_value_id: z.string().uuid(),
	approved_by: z.string().uuid().optional(),
	notes: z.string().max(1024).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type SettingsValueApproveCommand = z.infer<
	typeof SettingsValueApproveCommandSchema
>;

export const SettingsValueRevertCommandSchema = z.object({
	setting_value_id: z.string().uuid(),
	reason: z.string().max(1024).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type SettingsValueRevertCommand = z.infer<
	typeof SettingsValueRevertCommandSchema
>;
