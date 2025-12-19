/**
 * Command Center catalog & routing schemas
 * @tables command_templates, command_routes, command_features, command_dispatches
 */

import { z } from "zod";

import { jsonbMetadata, uuid } from "../../shared/base-schemas.js";
import {
	CommandDispatchStatusEnum,
	CommandFeatureStatusEnum,
	CommandRouteStatusEnum,
} from "../../shared/enums.js";

export const CommandTemplateSchema = z.object({
	id: uuid,
	command_name: z.string(),
	version: z.string(),
	description: z.string().nullable().optional(),
	default_target_service: z.string(),
	default_topic: z.string(),
	required_modules: z.array(z.string()),
	payload_schema: z.record(z.unknown()),
	sample_payload: z.record(z.unknown()),
	metadata: jsonbMetadata,
	created_at: z.date(),
	updated_at: z.date(),
});
export type CommandTemplate = z.infer<typeof CommandTemplateSchema>;

export const CommandRouteSchema = z.object({
	id: uuid,
	command_name: z.string(),
	environment: z.string(),
	tenant_id: uuid.nullable().optional(),
	service_id: z.string(),
	topic: z.string(),
	weight: z.number().int(),
	status: CommandRouteStatusEnum,
	metadata: jsonbMetadata,
	created_at: z.date(),
	updated_at: z.date(),
});
export type CommandRoute = z.infer<typeof CommandRouteSchema>;

export const CommandFeatureSchema = z.object({
	id: uuid,
	command_name: z.string(),
	environment: z.string(),
	tenant_id: uuid.nullable().optional(),
	status: CommandFeatureStatusEnum,
	max_per_minute: z.number().int().nullable().optional(),
	burst: z.number().int().nullable().optional(),
	metadata: jsonbMetadata,
	created_at: z.date(),
	updated_at: z.date(),
});
export type CommandFeature = z.infer<typeof CommandFeatureSchema>;

export const CommandDispatchSchema = z.object({
	id: uuid,
	command_name: z.string(),
	tenant_id: uuid,
	target_service: z.string(),
	target_topic: z.string(),
	correlation_id: z.string().nullable().optional(),
	request_id: z.string(),
	status: CommandDispatchStatusEnum,
	payload_hash: z.string(),
	outbox_event_id: uuid,
	routing_metadata: z.record(z.unknown()),
	initiated_by: z.record(z.unknown()).nullable().optional(),
	issued_at: z.date(),
	metadata: jsonbMetadata,
	created_at: z.date(),
	updated_at: z.date(),
});
export type CommandDispatch = z.infer<typeof CommandDispatchSchema>;
