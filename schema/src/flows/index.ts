/**
 * DEV DOC
 * Module: index.ts
 * Purpose: Re-exports all flow contract types and registry.
 * Ownership: Schema package
 */

export { FlowId, ALL_FLOW_IDS } from "./flow-ids.js";
export { FLOW_REGISTRY } from "./flow-registry.js";
export type {
  CommandDeclaration,
  EventConsumerDeclaration,
  FlowParticipation,
  FlowRegistry,
  FlowRequirement,
  GateDeclaration,
  ServiceFlowManifest,
} from "./types.js";
