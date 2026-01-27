/**
 * DEV DOC
 * Module: events/commands/integrations.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

export const IntegrationOtaSyncRequestCommandSchema = z.object({
	property_id: z.string().uuid(),
	ota_code: z.string().min(2).max(50),
	sync_scope: z.string().max(50).optional(),
	requested_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type IntegrationOtaSyncRequestCommand = z.infer<
	typeof IntegrationOtaSyncRequestCommandSchema
>;

export const IntegrationOtaRatePushCommandSchema = z.object({
	property_id: z.string().uuid(),
	ota_code: z.string().min(2).max(50),
	rate_plan_id: z.string().uuid().optional(),
	effective_from: z.coerce.date().optional(),
	effective_to: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type IntegrationOtaRatePushCommand = z.infer<
	typeof IntegrationOtaRatePushCommandSchema
>;

export const IntegrationWebhookRetryCommandSchema = z.object({
	subscription_id: z.string().uuid(),
	event_id: z.string().uuid().optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type IntegrationWebhookRetryCommand = z.infer<
	typeof IntegrationWebhookRetryCommandSchema
>;

export const IntegrationMappingUpdateCommandSchema = z.object({
	mapping_id: z.string().uuid(),
	mapping_payload: z.record(z.unknown()),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type IntegrationMappingUpdateCommand = z.infer<
	typeof IntegrationMappingUpdateCommandSchema
>;
