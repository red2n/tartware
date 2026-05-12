/**
 * DEV DOC
 * Module: flow-ids.ts
 * Purpose: Canonical PMS flow identifiers — each represents a complete guest lifecycle flow.
 * Ownership: Schema package (single source of truth)
 */

/**
 * The 12 canonical PMS flows that compose the guest lifecycle.
 * These form a DAG (directed acyclic graph), not a linear sequence.
 */
export const FlowId = {
  PROPERTY_SETUP: "flow.property_setup",
  RATE_PRICING: "flow.rate_pricing",
  GUEST_PROFILE: "flow.guest_profile",
  RESERVATION: "flow.reservation",
  PRE_ARRIVAL: "flow.pre_arrival",
  CHECK_IN: "flow.check_in",
  IN_HOUSE: "flow.in_house",
  NIGHT_AUDIT: "flow.night_audit",
  CHECK_OUT: "flow.check_out",
  HOUSEKEEPING: "flow.housekeeping",
  AR_COLLECTIONS: "flow.ar_collections",
  CHANNEL_DISTRIBUTION: "flow.channel_distribution",
} as const;

export type FlowId = (typeof FlowId)[keyof typeof FlowId];

/** All flow IDs as an array for iteration. */
export const ALL_FLOW_IDS = Object.values(FlowId);
