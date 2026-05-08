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
  readonly requiredGates?: readonly {
    readonly gateName: string;
    readonly guardsCommand: string;
  }[];
  /** Flows that must be operational before this flow can function */
  readonly dependsOn?: readonly FlowId[];
};

/**
 * The master flow registry — maps every FlowId to its requirements.
 * Used by the boot-time validator.
 */
export type FlowRegistry = Record<FlowId, FlowRequirement>;
