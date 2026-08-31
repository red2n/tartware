/**
 * DEV DOC
 * Module: types.ts
 * Purpose: Flow contract types — compile-time enforcement of flow participation.
 * Ownership: Schema package (single source of truth)
 *
 * Services declare a `ServiceFlowManifest` at boot time.
 * The validator cross-checks all manifests against `FLOW_REGISTRY` to ensure
 * every required command, event, and gate has exactly one handler.
 */

import type { FlowId } from "./flow-ids.js";

// ─── Handler declarations ────────────────────────────────────────────────────

/**
 * A command this service handles for a given flow.
 * The service MUST have a matching `case` in its `routeCommand` switch.
 */
export type CommandDeclaration = {
	/** The exact command name (e.g. "reservation.create") */
	readonly commandName: string;
	/** Optional human description for documentation */
	readonly description?: string;
};

/**
 * A Kafka event this service consumes for a given flow.
 * The service MUST have a consumer subscribed to the topic with matching event handling.
 */
export type EventConsumerDeclaration = {
	/** Kafka topic (e.g. "reservations.events") */
	readonly topic: string;
	/** Event type filter (e.g. "reservation.checked_out") */
	readonly eventType: string;
	/** Optional human description */
	readonly description?: string;
};

/**
 * A gate (pre-condition check) this service enforces for a given flow.
 * Gates are validation checks that must pass before a command proceeds.
 */
export type GateDeclaration = {
	/** Gate identifier (e.g. "blacklist_check") */
	readonly gateName: string;
	/** Which command this gate guards */
	readonly guardsCommand: string;
	/** Optional human description */
	readonly description?: string;
};

// ─── Flow participation ──────────────────────────────────────────────────────

/**
 * What a service contributes to a single flow.
 * At least one of commands/events/gates must be non-empty.
 */
export type FlowParticipation = {
	/** Commands this service handles for this flow */
	readonly commands?: readonly CommandDeclaration[];
	/** Events this service consumes for this flow */
	readonly events?: readonly EventConsumerDeclaration[];
	/** Gates this service enforces for this flow */
	readonly gates?: readonly GateDeclaration[];
};

// ─── Service manifest ────────────────────────────────────────────────────────

/**
 * A typed manifest declaring which flows a service participates in
 * and what it contributes to each flow.
 *
 * @example
 * ```ts
 * export const FLOW_MANIFEST: ServiceFlowManifest = {
 *   serviceId: "billing-service",
 *   flows: {
 *     [FlowId.NIGHT_AUDIT]: {
 *       commands: [{ commandName: "billing.night_audit.execute" }],
 *     },
 *     [FlowId.CHECK_OUT]: {
 *       commands: [{ commandName: "billing.express_checkout" }],
 *     },
 *   },
 * };
 * ```
 */
export type ServiceFlowManifest = {
	/** Unique service identifier (e.g. "billing-service") */
	readonly serviceId: string;
	/** Optional version of the manifest for tracking changes */
	readonly version?: string;
	/** Map of FlowId → what this service contributes */
	readonly flows: Partial<Record<FlowId, FlowParticipation>>;
};

// ─── Flow registry (master requirements) ─────────────────────────────────────

/**
 * How `flow:integrity` proves a declared control still exists in the code.
 *
 * The registry can require a gate and a manifest can claim it, and neither
 * knows whether anything still enforces one. That is not hypothetical: the
 * three night-audit gates were declared, claimed and verified by nothing for
 * as long as they existed, and deleting them from the handler would have kept
 * every test green — a night audit that skips its preconditions still runs a
 * night audit.
 *
 * So a declaration has to carry its own proof. `file` is repo-relative and
 * `token` is a literal that must appear in it; the check is deliberately a
 * substring match rather than anything cleverer, because its job is to fail
 * when the enforcing code is deleted or renamed, not to understand it.
 */
export type GateEvidence = {
	/** Repo-relative path, e.g. `Apps/billing-service/src/...`. */
	readonly file: string;
	/** A literal that must appear in that file for the claim to hold. */
	readonly token: string;
};

/**
 * Whether a declared control refuses, or only records.
 *
 * `gate` is a precondition: it stops the command, and an operator with
 * `force` gets past it — which is when the `flow_approvals` row is written.
 * `record` is written unconditionally, because the operation itself is the
 * controlled thing: every room move and every reversal lands a row whether or
 * not a gate was bypassed, with `forced` saying which.
 *
 * Both belong in the registry, and conflating them would make it lie in a new
 * way — a reversal is not a precondition on anything, and declaring it as one
 * would claim a control that does not exist.
 */
export type FlowControlKind = "gate" | "record";

/** One control a flow requires, and the proof that it is still enforced. */
export type FlowGateRequirement = {
	/** Gate identifier, matching the `gate_name` written to `flow_approvals`. */
	readonly gateName: string;
	/** Which command this control belongs to */
	readonly guardsCommand: string;
	/** Defaults to `"gate"` — a precondition that refuses. */
	readonly kind?: FlowControlKind;
	/** Optional human description */
	readonly description?: string;
	/**
	 * What must be present in the source for this declaration to be true.
	 * Required: a control nobody can verify is the state this whole check
	 * exists to prevent.
	 */
	readonly evidence: readonly GateEvidence[];
};

/**
 * What a single flow requires across ALL services.
 * The validator checks that every requirement has at least one service claiming it.
 */
export type FlowRequirement = {
	/** Human-readable flow name */
	readonly name: string;
	/** Commands that MUST be handled by some service */
	readonly requiredCommands: readonly string[];
	/** Events that MUST be consumed by some service */
	readonly requiredEvents?: readonly {
		readonly topic: string;
		readonly eventType: string;
	}[];
	/** Gates that MUST be enforced by some service */
	readonly requiredGates?: readonly FlowGateRequirement[];
	/** Flows that must be operational before this flow can function */
	readonly dependsOn?: readonly FlowId[];
};

/**
 * The master flow registry — maps every FlowId to its requirements.
 * Used by the boot-time validator.
 */
export type FlowRegistry = Record<FlowId, FlowRequirement>;
