/**
 * DEV DOC
 * Module: schemas/10-compliance/data-retention-policies.ts
 * Description: DataRetentionPolicies Schema
 * Table: data_retention_policies
 * Category: 10-compliance
 * Primary exports: DataRetentionPoliciesSchema, CreateDataRetentionPoliciesSchema, UpdateDataRetentionPoliciesSchema
 * @table data_retention_policies
 * @category 10-compliance
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

export const DataRetentionPoliciesSchema = z.object({
	policy_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	entity_type: z.string().min(1).max(100),
	retention_days: z.number().int().positive(),
	action: z.enum(["anonymize", "delete", "archive"]),
	is_active: z.boolean(),
	legal_basis: z.string().max(200).optional(),
	description: z.string().optional(),
	exempt_statuses: z.array(z.string()).optional(),
	last_sweep_at: z.coerce.date().optional(),
	last_sweep_count: z.number().int().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
});

export type DataRetentionPolicies = z.infer<typeof DataRetentionPoliciesSchema>;

export const CreateDataRetentionPoliciesSchema =
	DataRetentionPoliciesSchema.omit({
		policy_id: true,
		last_sweep_at: true,
		last_sweep_count: true,
		created_at: true,
		updated_at: true,
	});

export type CreateDataRetentionPolicies = z.infer<
	typeof CreateDataRetentionPoliciesSchema
>;

export const UpdateDataRetentionPoliciesSchema =
	DataRetentionPoliciesSchema.partial().required({
		policy_id: true,
	});

export type UpdateDataRetentionPolicies = z.infer<
	typeof UpdateDataRetentionPoliciesSchema
>;
