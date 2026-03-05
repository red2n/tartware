/**
 * DEV DOC
 * Module: api/command-center.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";
import { CommandFeatureStatusEnum } from "../shared/enums.js";

export const CommandExecuteRequestSchema = z.object({
	tenant_id: uuid,
	payload: z.record(z.unknown()),
	correlation_id: z.string().min(1).optional(),
	metadata: z
		.object({
			initiated_by: z
				.object({
					user_id: uuid,
					role: z.string().min(1),
				})
				.optional(),
		})
		.optional(),
});
export type CommandExecuteRequest = z.infer<typeof CommandExecuteRequestSchema>;

export const CommandExecuteResponseSchema = z.object({
	status: z.literal("accepted"),
	commandId: z.string(),
	commandName: z.string(),
	tenantId: uuid,
	correlationId: z.string().optional(),
	targetService: z.string(),
	requestedAt: z.string(),
});
export type CommandExecuteResponse = z.infer<
	typeof CommandExecuteResponseSchema
>;

export const CommandDefinitionSchema = z.object({
	name: z.string(),
	label: z.string(),
	description: z.string(),
	samplePayload: z.record(z.unknown()).optional(),
});
export type CommandDefinition = z.infer<typeof CommandDefinitionSchema>;

/** API response item for command feature management listing */
export const CommandFeatureListItemSchema = z.object({
	command_name: z.string(),
	label: z.string(),
	description: z.string(),
	default_target_service: z.string(),
	required_modules: z.array(z.string()),
	version: z.string(),
	feature_id: z.string().nullable(),
	status: CommandFeatureStatusEnum,
	max_per_minute: z.number().int().nullable(),
	burst: z.number().int().nullable(),
});
export type CommandFeatureListItem = z.infer<
	typeof CommandFeatureListItemSchema
>;

/** Request body for updating a command feature status */
export const UpdateCommandFeatureRequestSchema = z.object({
	status: CommandFeatureStatusEnum,
});
export type UpdateCommandFeatureRequest = z.infer<
	typeof UpdateCommandFeatureRequestSchema
>;

/** Response after updating a command feature */
export const UpdateCommandFeatureResponseSchema = z.object({
	command_name: z.string(),
	status: CommandFeatureStatusEnum,
	updated_at: z.string(),
});
export type UpdateCommandFeatureResponse = z.infer<
	typeof UpdateCommandFeatureResponseSchema
>;

/** Request body for batch-updating command feature statuses */
export const BatchUpdateCommandFeaturesRequestSchema = z.object({
	updates: z
		.array(
			z.object({
				command_name: z.string().min(1),
				status: CommandFeatureStatusEnum,
			}),
		)
		.min(1)
		.max(200),
});
export type BatchUpdateCommandFeaturesRequest = z.infer<
	typeof BatchUpdateCommandFeaturesRequestSchema
>;

/** Response after batch-updating command features */
export const BatchUpdateCommandFeaturesResponseSchema = z.object({
	updated: z.array(UpdateCommandFeatureResponseSchema),
	failed: z.array(
		z.object({
			command_name: z.string(),
			error: z.string(),
		}),
	),
});
export type BatchUpdateCommandFeaturesResponse = z.infer<
	typeof BatchUpdateCommandFeaturesResponseSchema
>;
