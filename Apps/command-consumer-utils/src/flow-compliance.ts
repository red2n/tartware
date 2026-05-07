/**
 * DEV DOC
 * Module: flow-compliance.ts
 * Purpose: Boot-time validator that ensures service flow manifests collectively
 *          cover all requirements in the flow registry.
 * Ownership: command-consumer-utils (shared infra)
 *
 * Usage:
 *   import { validateFlowCompliance } from "@tartware/command-consumer-utils/flow-compliance";
 *   validateFlowCompliance([billingManifest, reservationsManifest, ...], { logger });
 *
 * Throws `FlowComplianceError` if any required command, event, or gate is unclaimed.
 */

import {
  ALL_FLOW_IDS,
  FLOW_REGISTRY,
  type FlowId,
  type ServiceFlowManifest,
} from "@tartware/schemas";

// ─── Error type ──────────────────────────────────────────────────────────────

export type FlowViolation = {
  flowId: FlowId;
  flowName: string;
  type: "unclaimed_command" | "unclaimed_event" | "unclaimed_gate";
  detail: string;
};

export class FlowComplianceError extends Error {
  constructor(public readonly violations: FlowViolation[]) {
    const summary = violations.map((v) => `  [${v.flowName}] ${v.type}: ${v.detail}`).join("\n");
    super(`Flow compliance check failed — ${violations.length} violation(s):\n${summary}`);
    this.name = "FlowComplianceError";
  }
}

// ─── Options ─────────────────────────────────────────────────────────────────

export type ValidateFlowComplianceOptions = {
  /** Logger to emit warnings/info. If omitted, uses console. */
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  /**
   * How to handle violations:
   * - "throw" (default): throw FlowComplianceError on any violation
   * - "warn": log violations as warnings but don't throw
   */
  mode?: "throw" | "warn";
  /** Flows to skip validation for (e.g. flows not yet implemented) */
  skipFlows?: FlowId[];
};

// ─── Validator ───────────────────────────────────────────────────────────────

/**
 * Validates that a set of service manifests collectively cover
 * all requirements in the flow registry.
 *
 * Call this at boot time with all manifests for services in the current process
 * (or a full set for integration testing).
 *
 * @param manifests - Array of service flow manifests to validate
 * @param options - Validation options
 * @returns Array of violations (empty if compliant)
 * @throws FlowComplianceError if mode is "throw" and violations exist
 */
export function validateFlowCompliance(
  manifests: readonly ServiceFlowManifest[],
  options: ValidateFlowComplianceOptions = {},
): FlowViolation[] {
  const { logger = console, mode = "throw", skipFlows = [] } = options;
  const skipSet = new Set(skipFlows);
  const violations: FlowViolation[] = [];

  // Build lookup: command → service(s) claiming it
  const claimedCommands = new Map<string, string[]>();
  // Build lookup: "topic::eventType" → service(s) claiming it
  const claimedEvents = new Map<string, string[]>();
  // Build lookup: "gateName::guardsCommand" → service(s) claiming it
  const claimedGates = new Map<string, string[]>();

  for (const manifest of manifests) {
    for (const [, participation] of Object.entries(manifest.flows)) {
      if (participation.commands) {
        for (const cmd of participation.commands) {
          const existing = claimedCommands.get(cmd.commandName) ?? [];
          existing.push(manifest.serviceId);
          claimedCommands.set(cmd.commandName, existing);
        }
      }
      if (participation.events) {
        for (const evt of participation.events) {
          const key = `${evt.topic}::${evt.eventType}`;
          const existing = claimedEvents.get(key) ?? [];
          existing.push(manifest.serviceId);
          claimedEvents.set(key, existing);
        }
      }
      if (participation.gates) {
        for (const gate of participation.gates) {
          const key = `${gate.gateName}::${gate.guardsCommand}`;
          const existing = claimedGates.get(key) ?? [];
          existing.push(manifest.serviceId);
          claimedGates.set(key, existing);
        }
      }
    }
  }

  // Check each flow's requirements against claims
  for (const flowId of ALL_FLOW_IDS) {
    if (skipSet.has(flowId)) continue;

    const requirement = FLOW_REGISTRY[flowId];

    // Check required commands
    for (const cmd of requirement.requiredCommands) {
      if (!claimedCommands.has(cmd)) {
        violations.push({
          flowId,
          flowName: requirement.name,
          type: "unclaimed_command",
          detail: cmd,
        });
      }
    }

    // Check required events
    if (requirement.requiredEvents) {
      for (const evt of requirement.requiredEvents) {
        const key = `${evt.topic}::${evt.eventType}`;
        if (!claimedEvents.has(key)) {
          violations.push({
            flowId,
            flowName: requirement.name,
            type: "unclaimed_event",
            detail: key,
          });
        }
      }
    }

    // Check required gates
    if (requirement.requiredGates) {
      for (const gate of requirement.requiredGates) {
        const key = `${gate.gateName}::${gate.guardsCommand}`;
        if (!claimedGates.has(key)) {
          violations.push({
            flowId,
            flowName: requirement.name,
            type: "unclaimed_gate",
            detail: key,
          });
        }
      }
    }
  }

  // Report results
  if (violations.length === 0) {
    logger.info(
      `[flow-compliance] All ${ALL_FLOW_IDS.length} flows validated — ${manifests.length} service manifest(s) cover all requirements.`,
    );
    return violations;
  }

  if (mode === "warn") {
    logger.warn(
      `[flow-compliance] ${violations.length} flow violation(s) detected (warn mode — not blocking boot).`,
    );
    for (const v of violations) {
      logger.warn(`  [${v.flowName}] ${v.type}: ${v.detail}`);
    }
    return violations;
  }

  throw new FlowComplianceError(violations);
}
