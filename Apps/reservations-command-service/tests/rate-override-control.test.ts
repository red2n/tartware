/**
 * The rate override states why, and only for someone entitled to say it (A06).
 *
 * What this replaced: `reason` was optional free text that landed in
 * `internal_notes`, and the six RATE_OVERRIDE codes seeded since the table was
 * created — manager's discount, competitor match, service recovery, each with
 * the `approval_level` its decision takes — were resolved by nothing. The most
 * common way money leaves a hotel was the least answerable act in the product.
 *
 * The control is a record rather than a gate: overriding a rate is legitimate
 * daily work, so nothing is refused except an override the caller's role does
 * not reach.
 */

import { describe, expect, it } from "vitest";

import { ReservationRateOverrideCommandSchema } from "../src/schemas/reservation-command.js";

const base = {
  reservation_id: "11111111-1111-1111-1111-111111111111",
  total_amount: 149,
};

describe("the payload demands a code", () => {
  it("refuses an override that names no reason code", () => {
    const result = ReservationRateOverrideCommandSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("reason_code");
  });

  it("accepts one that does", () => {
    expect(
      ReservationRateOverrideCommandSchema.safeParse({
        ...base,
        reason_code: "RO_MGR_DISC",
      }).success,
    ).toBe(true);
  });

  it("still requires something to actually change", () => {
    // The older refinement stays: a command that names a code and moves
    // nothing is a record of a decision that was never taken.
    expect(
      ReservationRateOverrideCommandSchema.safeParse({
        reservation_id: base.reservation_id,
        reason_code: "RO_MGR_DISC",
      }).success,
    ).toBe(false);
  });

  it("rejects a code too short to be a real one", () => {
    expect(
      ReservationRateOverrideCommandSchema.safeParse({
        ...base,
        reason_code: "X",
      }).success,
    ).toBe(false);
  });

  it("keeps the free-text reason as notes, not as the record", () => {
    // `reason` survives — it is the sentence a clerk types — but it is no
    // longer the only thing saying why the rate moved.
    const parsed = ReservationRateOverrideCommandSchema.safeParse({
      ...base,
      reason_code: "RO_RECOVERY",
      reason: "guest was moved twice on arrival night",
    });
    expect(parsed.success).toBe(true);
  });
});
