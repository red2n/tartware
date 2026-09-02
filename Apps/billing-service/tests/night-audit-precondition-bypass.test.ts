/**
 * `skip_preconditions` bypasses the three gates the NIGHT_AUDIT flow declares.
 *
 * It always wrote a `flow_approvals` row, so the bypass was never silent — what
 * it lacked was a reason anyone could act on. The row carried the hardcoded
 * literal "SKIP_PRECONDITIONS", a code that did not have to exist in
 * `reason_codes`, could not be grouped or reported on, and carried neither
 * `requires_approval` nor `approval_level`. Every other override in the product
 * resolves its code and refuses an unknown one.
 */

import {
  assertForcedOverrideAuthority,
  forcedOverrideMinRole,
  SYSTEM_ACTOR_ROLE,
} from "@tartware/command-consumer-utils/command-utils";
import { FlowId, flowControlNames } from "@tartware/schemas";
import { describe, expect, it } from "vitest";

import { BillingNightAuditCommandSchema } from "../src/schemas/billing-commands.js";

const base = {
  tenant_id: "11111111-1111-1111-1111-111111111111",
  property_id: "22222222-2222-2222-2222-222222222222",
};

describe("the skip has to state why", () => {
  it("lets an ordinary audit run with no reason at all", () => {
    expect(BillingNightAuditCommandSchema.safeParse(base).success).toBe(true);
  });

  it("refuses a skip with no reason code", () => {
    const result = BillingNightAuditCommandSchema.safeParse({
      ...base,
      skip_preconditions: true,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("skip_reason_code");
  });

  it("accepts a skip that names one", () => {
    expect(
      BillingNightAuditCommandSchema.safeParse({
        ...base,
        skip_preconditions: true,
        skip_reason_code: "NA_SYSTEM_RECOVERY",
      }).success,
    ).toBe(true);
  });

  it("does not demand a reason from a run that skips nothing", () => {
    // skip_preconditions: false is the explicit form of the default. Requiring
    // a reason there would make every scheduled audit carry one.
    expect(
      BillingNightAuditCommandSchema.safeParse({
        ...base,
        skip_preconditions: false,
      }).success,
    ).toBe(true);
  });

  it("rejects a reason code too short to be a real one", () => {
    expect(
      BillingNightAuditCommandSchema.safeParse({
        ...base,
        skip_preconditions: true,
        skip_reason_code: "X",
      }).success,
    ).toBe(false);
  });
});

describe("the gates it bypasses come from the registry", () => {
  it("names the three preconditions NIGHT_AUDIT declares", () => {
    // The handler reads this same call rather than holding a literal array —
    // that array was a fourth copy of these names, and it was the copy that
    // decided what the audit trail recorded.
    expect(
      flowControlNames(FlowId.NIGHT_AUDIT, {
        guardsCommand: "billing.night_audit.execute",
      }),
    ).toEqual([
      "open_arrivals_check",
      "open_departures_check",
      "unbalanced_folios_check",
    ]);
  });

  it("does not include the bypass record among the gates it bypasses", () => {
    expect(
      flowControlNames(FlowId.NIGHT_AUDIT, {
        guardsCommand: "billing.night_audit.execute",
      }),
    ).not.toContain("night_audit_precondition_bypass");
  });
});

/**
 * A08's last site. The skip resolved its reason code and then never read it —
 * night audit had the input every other override gate uses and measured
 * nothing against it, so closing a business date over unresolved arrivals or
 * unbalanced folios proceeded on whoever's session was open.
 *
 * The check now runs before the `flow_approvals` write, which is deliberate:
 * that write is fail-open by design, so an authority check placed after it
 * could be skipped by the same failure that swallows the row.
 */
describe("skipping a precondition costs the code's authority", () => {
  const naCode = (over: Record<string, unknown> = {}) => ({
    reason_id: "na1",
    reason_code: "NA_FOLIOS_UNBALANCED",
    reason_name: "Folios unbalanced at roll",
    reason_category: "NIGHT_AUDIT",
    requires_approval: true,
    approval_level: "NONE",
    has_financial_impact: true,
    ...over,
  });

  it("floors every seeded NIGHT_AUDIT code at MANAGER", () => {
    // All four ship requires_approval=TRUE with approval_level 'NONE'. That
    // pairing is not "ask nobody": forcedOverrideMinRole reads the flag as a
    // demand and the absent level as unspecified, so it lands on MANAGER. If
    // the flag were ever dropped the check would silently become a no-op,
    // which is what this pins.
    expect(forcedOverrideMinRole(naCode())).toBe("MANAGER");
  });

  it("refuses a clerk skipping the roll's preconditions", () => {
    expect(() =>
      assertForcedOverrideAuthority(naCode(), "STAFF", {
        commandName: "billing.night_audit.run",
        gateName: "unbalanced_folios_check",
      }),
    ).toThrow(/OVERRIDE_AUTHORITY_INSUFFICIENT|requires MANAGER/);
  });

  it("lets a manager skip it", () => {
    expect(() =>
      assertForcedOverrideAuthority(naCode(), "MANAGER", {
        commandName: "billing.night_audit.run",
        gateName: "unbalanced_folios_check",
      }),
    ).not.toThrow();
  });

  it("refuses a scheduler or a replay", () => {
    // SYSTEM_ACTOR_ROLE is deliberately not a member of TenantRoleEnum: an
    // unattended re-run must not close a date a person could not.
    expect(() =>
      assertForcedOverrideAuthority(naCode(), SYSTEM_ACTOR_ROLE, {
        commandName: "billing.night_audit.run",
        gateName: "unbalanced_folios_check",
      }),
    ).toThrow();
  });
});
