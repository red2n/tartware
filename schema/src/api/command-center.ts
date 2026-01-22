/**
 * DEV DOC
 * Module: api/command-center.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

export const CommandExecuteRequestSchema = z.object({
	tenant_id: uuid,
	payload: z.record(z.unknown()),
	correlation_id: z.string().optional(),
	initiated_by: z
		.object({
			user_id: uuid,
			role: z.string().min(1),
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
export type CommandExecuteResponse = z.infer<typeof CommandExecuteResponseSchema>;

export const CommandDefinitionSchema = z.object({
	name: z.string(),
	label: z.string(),
	description: z.string(),
	samplePayload: z.record(z.unknown()).optional(),
});
export type CommandDefinition = z.infer<typeof CommandDefinitionSchema>;
