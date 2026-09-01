/**
 * A write-off states what was decided, not just who decided it (A07).
 *
 * Dual control (A04) settled the *who*: two owners, one raising and one
 * releasing. The *what* was a sentence of free text with a ten-character floor,
 * so a year of write-offs could not be separated into bad debt, goodwill,
 * settled disputes and small balances — the first cut an auditor asks for.
 */

import { FlowId, flowControlNames } from "@tartware/schemas";
import { describe, expect, it } from "vitest";

import { ArCityLedgerWriteOffCommandSchema } from "../src/schemas/billing-commands.js";

const base = {
  property_id: "11111111-1111-1111-1111-111111111111",
  city_ledger_id: "22222222-2222-2222-2222-222222222222",
  amount: 250,
  reason: "collection agency returned the account as uncollectable",
};

describe("the payload demands a code", () => {
  it("refuses a write-off with narrative alone", () => {
    const result = ArCityLedgerWriteOffCommandSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("reason_code");
  });

  it("accepts one that names a code", () => {
    expect(
      ArCityLedgerWriteOffCommandSchema.safeParse({
        ...base,
        reason_code: "WO_BAD_DEBT",
      }).success,
    ).toBe(true);
  });

  it("still demands the narrative as well as the code", () => {
    // The code groups; the sentence explains this one. Neither replaces the
    // other, which is why `reason` keeps its ten-character floor.
    expect(
      ArCityLedgerWriteOffCommandSchema.safeParse({
        ...base,
        reason: "bad",
        reason_code: "WO_BAD_DEBT",
      }).success,
    ).toBe(false);
  });
});

describe("the control is declared where the ledger work lives", () => {
  it("LEDGER_CONTROL declares the write-off record", () => {
    expect(
      flowControlNames(FlowId.LEDGER_CONTROL, {
        guardsCommand: "ar.city_ledger.write_off",
        kind: "record",
      }),
    ).toEqual(["write_off"]);
  });

  it("and keeps it separate from the dual-control gate on the same command", () => {
    // Two different questions about one command: may this person run it alone
    // (gate), and what did they decide (record). Collapsing them would lose the
    // second the day the first changes.
    expect(
      flowControlNames(FlowId.LEDGER_CONTROL, {
        guardsCommand: "ar.city_ledger.write_off",
        kind: "gate",
      }),
    ).toContain("dual_control");
  });
});
