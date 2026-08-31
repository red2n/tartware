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
