/**
 * DEV DOC
 * Module: flow-compliance.ts
 * Purpose: Boot-time validator that ensures service flow manifests collectively
 *          cover all requirements in the flow registry.
 * Ownership: command-consumer-utils (shared infra)
 *
 * Two validation modes:
 *
 * 1. **System-wide** (`validateFlowCompliance`):
 *    Aggregates ALL manifests and checks that every required command, event,
 *    and gate has at least one handler. Also validates the `dependsOn` DAG
 *    and detects duplicate command claims.
 *    Use in integration tests / CI.
 *
 * 2. **Per-service** (`validateServiceManifest`):
 *    Checks that a single service's manifest is internally consistent —
 *    every command/event/gate it claims actually exists in the flow registry.
 *    Catches phantom claims and empty participations.
 *    Use at service boot time.
 */

import {
  ALL_FLOW_IDS,
  FLOW_REGISTRY,
  type FlowId,
  type FlowParticipation,
  type ServiceFlowManifest,
} from "@tartware/schemas";

// ─── Error types ─────────────────────────────────────────────────────────────

export type FlowViolation = {
  flowId: FlowId;
  flowName: string;
  type:
    | "unclaimed_command"
    | "unclaimed_event"
    | "unclaimed_gate"
    | "duplicate_command"
    | "empty_participation"
    | "phantom_command"
    | "phantom_event"
    | "phantom_gate"
    | "dag_cycle"
    | "dag_missing_dependency";
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

// ─── DAG validation ──────────────────────────────────────────────────────────

/**
 * Validates the `dependsOn` DAG in the flow registry:
 * 1. All `dependsOn` references point to valid FlowId values.
 * 2. No cycles exist in the dependency graph.
 */
function validateDependencyDag(skipSet: Set<FlowId>): FlowViolation[] {
  const violations: FlowViolation[] = [];
  const allFlowIds = new Set<string>(ALL_FLOW_IDS);

  // Check for missing dependency references
  for (const flowId of ALL_FLOW_IDS) {
    if (skipSet.has(flowId)) continue;
    const requirement = FLOW_REGISTRY[flowId];
    if (!requirement.dependsOn) continue;

    for (const dep of requirement.dependsOn) {
      if (!allFlowIds.has(dep)) {
        violations.push({
          flowId,
          flowName: requirement.name,
          type: "dag_missing_dependency",
          detail: `depends on unknown flow "${dep}"`,
        });
      }
    }
  }

  // Topological sort cycle detection (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const flowId of ALL_FLOW_IDS) {
    if (skipSet.has(flowId)) continue;
    inDegree.set(flowId, 0);
    adjacency.set(flowId, []);
  }

  for (const flowId of ALL_FLOW_IDS) {
    if (skipSet.has(flowId)) continue;
    const requirement = FLOW_REGISTRY[flowId];
    if (!requirement.dependsOn) continue;

    for (const dep of requirement.dependsOn) {
      if (skipSet.has(dep as FlowId)) continue;
      adjacency.get(dep)?.push(flowId);
      inDegree.set(flowId, (inDegree.get(flowId) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    processed++;
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  const activeFlowCount = [...inDegree.keys()].length;
  if (processed < activeFlowCount) {
    // Find which flows are in the cycle
    const cycleFlows = [...inDegree.entries()].filter(([, degree]) => degree > 0).map(([id]) => id);

    for (const flowId of cycleFlows) {
      const requirement = FLOW_REGISTRY[flowId as FlowId];
      violations.push({
        flowId: flowId as FlowId,
        flowName: requirement?.name ?? flowId,
        type: "dag_cycle",
        detail: `Part of dependency cycle involving: ${cycleFlows.join(", ")}`,
      });
    }
  }

  return violations;
}

// ─── System-wide validator ───────────────────────────────────────────────────

/**
 * Validates that a set of service manifests collectively cover
 * all requirements in the flow registry.
 *
 * Call this in integration tests or CI with ALL manifests.
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
  const { logger = globalThis.console, mode = "throw", skipFlows = [] } = options;
  const skipSet = new Set(skipFlows);
  const violations: FlowViolation[] = [];

  // Build lookup: command → service(s) claiming it
  const claimedCommands = new Map<string, string[]>();
  // Build lookup: "topic::eventType" → service(s) claiming it
  const claimedEvents = new Map<string, string[]>();
  // Build lookup: "gateName::guardsCommand" → service(s) claiming it
  const claimedGates = new Map<string, string[]>();

  for (const manifest of manifests) {
    for (const participation of Object.values(manifest.flows) as FlowParticipation[]) {
      // Check for empty participation (gap 10)
      if (
        (!participation.commands || participation.commands.length === 0) &&
        (!participation.events || participation.events.length === 0) &&
        (!participation.gates || participation.gates.length === 0)
      ) {
        violations.push({
          flowId: "unknown" as FlowId,
          flowName: manifest.serviceId,
          type: "empty_participation",
          detail: `${manifest.serviceId} declares a flow participation with no commands, events, or gates`,
        });
      }

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

  // Detect duplicate command claims (gap 8)
  for (const [cmd, services] of claimedCommands) {
    if (services.length > 1) {
      violations.push({
        flowId: "unknown" as FlowId,
        flowName: "Cross-service",
        type: "duplicate_command",
        detail: `"${cmd}" claimed by multiple services: ${services.join(", ")}`,
      });
    }
  }

  // Validate dependsOn DAG (gap 1)
  violations.push(...validateDependencyDag(skipSet));

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

// ─── Per-service validator ───────────────────────────────────────────────────

/**
 * Validates a single service's manifest for internal consistency:
 * 1. Every command/event/gate the service claims must exist in the flow registry.
 * 2. No empty participation blocks.
 *
 * Use this at service boot time instead of `validateFlowCompliance` —
 * single-service validation cannot check cross-service coverage.
 *
 * @param manifest - The service's flow manifest
 * @param options - Logger and mode options
 * @returns Array of violations (empty if consistent)
 */
export function validateServiceManifest(
  manifest: ServiceFlowManifest,
  options: Pick<ValidateFlowComplianceOptions, "logger" | "mode"> = {},
): FlowViolation[] {
  const { logger = globalThis.console, mode = "warn" } = options;
  const violations: FlowViolation[] = [];

  // Build sets of valid commands/events/gates from registry
  const validCommands = new Set<string>();
  const validEvents = new Set<string>();
  const validGates = new Set<string>();

  for (const flowId of ALL_FLOW_IDS) {
    const req = FLOW_REGISTRY[flowId];
    for (const cmd of req.requiredCommands) {
      validCommands.add(cmd);
    }
    if (req.requiredEvents) {
      for (const evt of req.requiredEvents) {
        validEvents.add(`${evt.topic}::${evt.eventType}`);
      }
    }
    if (req.requiredGates) {
      for (const gate of req.requiredGates) {
        validGates.add(`${gate.gateName}::${gate.guardsCommand}`);
      }
    }
  }

  for (const [flowId, participation] of Object.entries(manifest.flows) as [
    FlowId,
    FlowParticipation,
  ][]) {
    const requirement = FLOW_REGISTRY[flowId];
    const flowName = requirement?.name ?? flowId;

    // Unknown flow ID
    if (!requirement) {
      violations.push({
        flowId,
        flowName: flowId,
        type: "phantom_command",
        detail: `${manifest.serviceId} claims participation in unknown flow "${flowId}"`,
      });
      continue;
    }

    // Empty participation check (gap 10)
    if (
      (!participation.commands || participation.commands.length === 0) &&
      (!participation.events || participation.events.length === 0) &&
      (!participation.gates || participation.gates.length === 0)
    ) {
      violations.push({
        flowId,
        flowName,
        type: "empty_participation",
        detail: `${manifest.serviceId} declares empty participation in flow "${flowName}"`,
      });
    }

    // Check commands exist in registry
    if (participation.commands) {
      for (const cmd of participation.commands) {
        if (!validCommands.has(cmd.commandName)) {
          violations.push({
            flowId,
            flowName,
            type: "phantom_command",
            detail: `${manifest.serviceId} claims command "${cmd.commandName}" which is not in the flow registry`,
          });
        }
      }
    }

    // Check events exist in registry
    if (participation.events) {
      for (const evt of participation.events) {
        const key = `${evt.topic}::${evt.eventType}`;
        if (!validEvents.has(key)) {
          violations.push({
            flowId,
            flowName,
            type: "phantom_event",
            detail: `${manifest.serviceId} claims event "${key}" which is not in the flow registry`,
          });
        }
      }
    }

    // Check gates exist in registry
    if (participation.gates) {
      for (const gate of participation.gates) {
        const key = `${gate.gateName}::${gate.guardsCommand}`;
        if (!validGates.has(key)) {
          violations.push({
            flowId,
            flowName,
            type: "phantom_gate",
            detail: `${manifest.serviceId} claims gate "${key}" which is not in the flow registry`,
          });
        }
      }
    }
  }

  // Validate registry DAG integrity at boot (Gap 1)
  // Registry validation only reads from FLOW_REGISTRY, so it's safe and fast.
  violations.push(...validateDependencyDag(new Set()));

  // Report
  if (violations.length === 0) {
    logger.info(
      `[flow-compliance] ${manifest.serviceId} manifest validated — ${Object.keys(manifest.flows).length} flow(s) consistent with registry.`,
    );
    return violations;
  }

  if (mode === "warn") {
    logger.warn(
      `[flow-compliance] ${manifest.serviceId}: ${violations.length} manifest violation(s) detected (warn mode).`,
    );
    for (const v of violations) {
      logger.warn(`  [${v.flowName}] ${v.type}: ${v.detail}`);
    }
    return violations;
  }

  throw new FlowComplianceError(violations);
}
