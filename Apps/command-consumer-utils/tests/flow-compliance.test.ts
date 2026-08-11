/**
 * System-wide flow compliance conformance test.
 *
 * `validateServiceManifest` runs at each service's boot and only checks that a
 * service does not claim commands/events/gates absent from the flow registry.
 * The inverse — that every requirement in FLOW_REGISTRY has *some* handler — is
 * `validateFlowCompliance`, which no service can run because it needs all
 * manifests at once. Without this test it never runs anywhere, so a flow
 * requirement can lose its last handler and nothing notices.
 *
 * Manifests are imported from the services deliberately: this is an
 * architecture conformance check that sits above the packages it inspects.
 */

import { FLOW_MANIFEST as billingManifest } from "../../billing-service/src/flow-manifest.js";
import { FLOW_MANIFEST as guestsManifest } from "../../guests-service/src/flow-manifest.js";
import { FLOW_MANIFEST as housekeepingManifest } from "../../housekeeping-service/src/flow-manifest.js";
import { FLOW_MANIFEST as notificationManifest } from "../../notification-service/src/flow-manifest.js";
import { FLOW_MANIFEST as reservationsManifest } from "../../reservations-command-service/src/flow-manifest.js";
import { FLOW_MANIFEST as revenueManifest } from "../../revenue-service/src/flow-manifest.js";
import { FLOW_MANIFEST as roomsManifest } from "../../rooms-service/src/flow-manifest.js";
import { describe, expect, it } from "vitest";

import { type FlowViolation, validateFlowCompliance } from "../src/flow-compliance.js";

/**
 * Every manifest in the system. A service that participates in a flow but is
 * missing here would make its claims invisible to the validator, so adding a
 * new service means adding it to this list.
 */
const ALL_MANIFESTS = [
  billingManifest,
  guestsManifest,
  housekeepingManifest,
  notificationManifest,
  reservationsManifest,
  revenueManifest,
  roomsManifest,
];

/** Collects violations instead of throwing, so failures list every gap at once. */
const collectViolations = (): FlowViolation[] => {
  try {
    validateFlowCompliance(ALL_MANIFESTS, {
      mode: "throw",
      logger: { info: () => {}, warn: () => {} },
    });
    return [];
  } catch (error) {
    const violations = (error as { violations?: FlowViolation[] }).violations;
    if (!violations) throw error;
    return violations;
  }
};

const format = (violations: FlowViolation[]): string =>
  violations.map((v) => `  [${v.flowName}] ${v.type}: ${v.detail}`).join("\n");

describe("flow compliance (system-wide)", () => {
  it("has a handler for every command, event, and gate the flow registry requires", () => {
    const violations = collectViolations();
    expect(violations, `\n${format(violations)}\n`).toEqual([]);
  });

  it("registers every service manifest exactly once", () => {
    const ids = ALL_MANIFESTS.map((m) => m.serviceId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
