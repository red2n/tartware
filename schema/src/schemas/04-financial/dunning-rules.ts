/**
 * DEV DOC
 * Module: schemas/04-financial/dunning-rules.ts
 * Description: AR Dunning Rules Configuration Schema
 * Table: ar_dunning_rules
 * Category: 04-financial
 * Primary exports: ArDunningRuleSchema, CreateArDunningRuleSchema, UpdateArDunningRuleSchema
 * @table ar_dunning_rules
 * @category 04-financial
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const DunningBucketNameEnum = z.enum(["CURRENT", "30", "60", "90", "90+"]);
export type DunningBucketName = z.infer<typeof DunningBucketNameEnum>;

export const DunningActionTypeEnum = z.enum(["EMAIL", "STATEMENT", "FORMAL_NOTICE", "COLLECTIONS"]);
export type DunningActionType = z.infer<typeof DunningActionTypeEnum>;

// ─── Full row schema ──────────────────────────────────────────────────────────

export const ArDunningRuleSchema = z.object({
	rule_id: uuid,
	tenant_id: uuid,
	property_id: uuid.nullable(),
	bucket_name: DunningBucketNameEnum,
	min_days_overdue: z.number().int().nonnegative(),
	max_days_overdue: z.number().int().nullable(),
	action_type: DunningActionTypeEnum,
	template_code: z.string().min(1).max(50),
	delay_days: z.number().int().nonnegative().default(0),
	max_attempts: z.number().int().positive().default(3),
	min_amount: z.coerce.number().nonnegative().default(0),
	escalation_order: z.number().int().positive().default(1),
	is_active: z.boolean().default(true),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
	created_by: uuid.nullable(),
	updated_by: uuid.nullable(),
});

export type ArDunningRule = z.infer<typeof ArDunningRuleSchema>;

// ─── Create input ─────────────────────────────────────────────────────────────

export const CreateArDunningRuleSchema = z.object({
	property_id: z.string().uuid().optional(),
	bucket_name: DunningBucketNameEnum,
	min_days_overdue: z.number().int().nonnegative(),
	max_days_overdue: z.number().int().nullable().optional(),
	action_type: DunningActionTypeEnum,
	template_code: z.string().min(1).max(50),
	delay_days: z.number().int().nonnegative().default(0),
	max_attempts: z.number().int().positive().default(3),
	min_amount: z.coerce.number().nonnegative().default(0),
	escalation_order: z.number().int().positive().default(1),
	is_active: z.boolean().default(true),
});

export type CreateArDunningRuleInput = z.infer<typeof CreateArDunningRuleSchema>;

// ─── Update input ─────────────────────────────────────────────────────────────

export const UpdateArDunningRuleSchema = z.object({
	rule_id: z.string().uuid(),
	template_code: z.string().min(1).max(50).optional(),
	delay_days: z.number().int().nonnegative().optional(),
	max_attempts: z.number().int().positive().optional(),
	min_amount: z.coerce.number().nonnegative().optional(),
	escalation_order: z.number().int().positive().optional(),
	is_active: z.boolean().optional(),
});

export type UpdateArDunningRuleInput = z.infer<typeof UpdateArDunningRuleSchema>;
