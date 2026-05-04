/**
 * DEV DOC
 * Module: api/command-center.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";
import { CommandFeatureStatusEnum } from "../shared/enums.js";

// =====================================================
// IDEMPOTENCY — envelope-level deduplication contract
// =====================================================
// Single source of truth for idempotency-key semantics across the platform.
// Every write command MUST carry an idempotency key supplied by the caller
// (HTTP `Idempotency-Key` header). The key is propagated through the outbox
// envelope as `metadata.requestId` / `metadata.idempotencyKey` and consumed
// by the dedupe table (`command_idempotency`) before handler execution.
//
// Format rules (aligned with IETF draft-ietf-httpapi-idempotency-key-header):
//   • opaque token between 8 and 128 chars
//   • only URL-safe characters (alphanumeric, '-', '_', ':')
//   • case-sensitive
//   • UUIDs are recommended but any opaque token is accepted
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_:-]{8,128}$/;

export const IdempotencyKeySchema = z
	.string()
	.regex(
		IDEMPOTENCY_KEY_PATTERN,
		"Idempotency-Key must be 8-128 URL-safe characters (alphanumeric, '-', '_', ':')",
	);
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

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
// =====================================================
// COMMAND HANDLER CONTEXT (service-layer)
// =====================================================

// =====================================================
// REPOSITORY ROW TYPES — command registry
// =====================================================

/** DB row shape for a command template record. */
export type CommandTemplateRow = {
	command_name: string;
	version: string;
	description: string | null;
	default_target_service: string;
	default_topic: string;
	required_modules: string[] | null;
	payload_schema: Record<string, unknown> | null;
	sample_payload: Record<string, unknown> | null;
	metadata: Record<string, unknown> | null;
};

/** DB row shape for a command route record. */
export type CommandRouteRow = {
	id: string;
	command_name: string;
	environment: string;
	tenant_id: string | null;
	service_id: string;
	topic: string;
	weight: number;
	status: "active" | "disabled";
	metadata: Record<string, unknown> | null;
};

/** DB row shape for a command feature record. */
export type CommandFeatureRow = {
	id: string;
	command_name: string;
	environment: string;
	tenant_id: string | null;
	status: "enabled" | "disabled" | "observation";
	max_per_minute: number | null;
	burst: number | null;
	metadata: Record<string, unknown> | null;
};

/** DB row shape returned by the command features list JOIN query. */
export type CommandFeatureListRow = {
	command_name: string;
	label: string;
	description: string;
	default_target_service: string;
	required_modules: string[] | null;
	version: string;
	feature_id: string | null;
	status: "enabled" | "disabled" | "observation";
	max_per_minute: number | null;
	burst: number | null;
};

/** DB row shape returned after updating a command feature status. */
export type CommandFeatureUpdateRow = {
	id: string;
	command_name: string;
	status: "enabled" | "disabled" | "observation";
	updated_at: string;
};

/**
 * Execution context passed to every command handler.
 *
 * Carries the tenant scope and caller identity resolved from the Kafka envelope metadata.
 * `payload` and `correlationId` are optional — some handlers receive the raw command
 * message bundled in the context object rather than as a separate parameter.
 */
export type CommandContext = {
	/** Tenant ID the command is scoped to */
	tenantId: string;
	/** Identity that initiated the command (may be null for system-generated commands) */
	initiatedBy?: { userId?: string } | null;
	/** Raw command payload (present when the handler destructures context for the full envelope) */
	payload?: unknown;
	/** Correlation ID from the Kafka message (for distributed tracing) */
	correlationId?: string;
};

// =============================================================================
// COMMAND DISPATCH — shared repository + service types
// (consumed by command-center-shared, api-gateway, command-center-service)
// =============================================================================

/** Generic DB query executor used across command dispatch repositories. */
export type QueryExecutor = <T extends Record<string, unknown> = Record<string, unknown>>(
	sql: string,
	params?: unknown[],
) => Promise<{ rows: T[] }>;

/** Input shape for inserting a new command dispatch record. */
export type InsertCommandDispatchInput = {
	id: string;
	commandName: string;
	tenantId: string;
	targetService: string;
	targetTopic: string;
	correlationId?: string;
	requestId: string;
	payloadHash: string;
	outboxEventId: string;
	routingMetadata: Record<string, unknown>;
	initiatedBy?: Record<string, unknown> | null;
	metadata?: Record<string, unknown>;
};

/** DB row returned by a command dispatch lookup query. */
export type CommandDispatchLookup = {
	id: string;
	command_name: string;
	tenant_id: string;
	correlation_id: string | null;
	request_id: string;
	payload_hash: string;
	target_service: string;
	target_topic: string;
	issued_at: string;
	routing_metadata: Record<string, unknown> | null;
	metadata: Record<string, unknown> | null;
};

/** In-memory snapshot of the command registry loaded from DB. */
export type CommandRegistrySnapshot = {
	templates: CommandTemplateRow[];
	routes: CommandRouteRow[];
	features: CommandFeatureRow[];
};

/** Identity of the user or system principal that initiated a command. */
export type Initiator = {
	userId: string;
	role: string;
} | null;

/** Resolved route record for a command. */
export type CommandRouteInfo = {
	id: string;
	command_name: string;
	environment: string;
	tenant_id: string | null;
	service_id: string;
	topic: string;
	weight: number;
	status: string;
	metadata: Record<string, unknown>;
	source: string;
};

/** Feature flag record for a command, controlling throttle and enable/disable. */
export type CommandFeatureInfo = {
	status: string;
	tenant_id: string | null;
	max_per_minute?: number | null;
	burst?: number | null;
	metadata: Record<string, unknown>;
};

/** Resolution outcome for a command lookup against the registry. */
export type CommandResolution<Membership = unknown> =
	| { status: "NOT_FOUND" }
	| { status: "MODULES_MISSING"; missingModules: string[] }
	| { status: "DISABLED"; reason: string }
	| {
			status: "RESOLVED";
			route: CommandRouteInfo;
			feature: CommandFeatureInfo | null;
			template?: unknown;
			membership?: Membership;
	  };

/** Input to the command acceptance pipeline. */
export interface AcceptCommandInput<Membership = unknown> {
	commandName: string;
	tenantId: string;
	payload: Record<string, unknown>;
	correlationId?: string;
	requestId: string;
	initiatedBy: Initiator;
	membership: Membership;
}

/** Outbox record written to the DB before Kafka publish (transactional outbox pattern). */
export interface CommandOutboxRecord {
	eventId: string;
	tenantId: string;
	aggregateId: string;
	aggregateType: string;
	eventType: string;
	payload: Record<string, unknown>;
	headers: Record<string, string>;
	correlationId?: string;
	partitionKey?: string;
	metadata?: Record<string, unknown>;
}

/** Dependency injection contract for the command dispatch service factory. */
export interface CommandDispatchDependencies<Membership = unknown> {
	resolveCommandForTenant: (
		args: Omit<AcceptCommandInput<Membership>, "payload" | "initiatedBy">,
	) => CommandResolution<Membership>;
	enqueueOutboxRecord: (record: CommandOutboxRecord) => Promise<void>;
	insertCommandDispatch: (input: InsertCommandDispatchInput) => Promise<void>;
	findCommandDispatchByRequest: (
		tenantId: string,
		commandName: string,
		requestId: string,
	) => Promise<CommandDispatchLookup | null>;
	throttleCommand?: (input: {
		commandName: string;
		tenantId: string;
		requestId: string;
		feature: CommandFeatureInfo | null;
	}) => Promise<boolean>;
}

/** Full result returned internally after successfully accepting a command. */
export type CommandAcceptanceResult = {
	status: "accepted";
	commandId: string;
	commandName: string;
	tenantId: string;
	correlationId?: string;
	targetService: string;
	targetTopic: string;
	issuedAt: string;
	headers: Record<string, string>;
	eventPayload: {
		metadata: Record<string, unknown>;
		payload: Record<string, unknown>;
	};
	featureStatus: string;
	route: {
		id: string;
		source: string;
		tenantId: string | null;
	};
};

/** Slim command acceptance response returned by the API gateway to callers. */
export type AcceptedCommand = {
	status: "accepted";
	commandId: string;
	commandName: string;
	tenantId: string;
	correlationId?: string;
	targetService: string;
	requestedAt: string;
	outboxEventId: string;
	envelope: {
		metadata: Record<string, unknown>;
		payload: Record<string, unknown>;
		headers: Record<string, string>;
		targetTopic: string;
	};
};

/** Public view of a command definition for API/UI consumers. */
export type CommandDefinitionView = {
	name: string;
	label: string;
	description: string;
	samplePayload: Record<string, unknown>;
	requiredModules: string[];
	defaultTargetService: string;
	defaultTopic: string;
	version: string;
};
