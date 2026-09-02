/**
 * Reading a tenant's policy, and what happens when there is not one.
 *
 * `resolveSettings` lived inside core-service, so the two services that apply
 * an override — billing and reservations — had no way to ask what a tenant's
 * approval threshold was. That is the whole reason A06 and A07 closed with
 * "thresholds still read by nothing".
 *
 * The behaviour worth pinning is the three-way outcome, and specifically that
 * the *middle* one is the ordinary case rather than the exception.
 */

import { describe, expect, it, vi } from "vitest";

import { isCommandError } from "../src/command-utils.js";
import { resolvePolicy, resolveSettingValues } from "../src/settings-utils.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const CODE = "WORKFLOW.RATES.APPROVALS";

type Policy = { discountApprovalThresholds: { percent: number; approverRole: string }[] };

/**
 * Hand-written rather than a Zod schema: `resolvePolicy` takes a `parse`
 * callback precisely so it owns no validation library, and this package does
 * not depend on one. The real callers pass their schema's `.parse`.
 */
const parsePolicy = (raw: unknown): Policy => {
  const rungs = (raw as { discountApprovalThresholds?: unknown })?.discountApprovalThresholds ?? [];
  if (!Array.isArray(rungs)) throw new Error("discountApprovalThresholds must be an array");
  for (const rung of rungs) {
    if (typeof (rung as { percent?: unknown })?.percent !== "number") {
      throw new Error("each rung needs a numeric percent");
    }
  }
  return { discountApprovalThresholds: rungs as Policy["discountApprovalThresholds"] };
};

const FALLBACK = { discountApprovalThresholds: [{ percent: 10, approverRole: "MANAGER" }] };

const queryReturning = (rows: { code: string; value: unknown }[]) =>
  vi.fn(async () => ({ rows }));

describe("resolveSettingValues", () => {
  it("asks the database only when there is something to ask for", async () => {
    const queryFn = queryReturning([]);
    expect((await resolveSettingValues(queryFn, { tenantId: TENANT, codes: [] })).size).toBe(0);
    expect((await resolveSettingValues(queryFn, { tenantId: "", codes: [CODE] })).size).toBe(0);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("returns one entry per code the tenant has", async () => {
    const queryFn = queryReturning([{ code: CODE, value: { a: 1 } }]);
    const values = await resolveSettingValues(queryFn, { tenantId: TENANT, codes: [CODE] });
    expect(values.get(CODE)).toEqual({ a: 1 });
  });

  it("leaves a code with no definition absent, rather than guessing at it", async () => {
    const values = await resolveSettingValues(queryReturning([]), {
      tenantId: TENANT,
      codes: [CODE],
    });
    expect(values.has(CODE)).toBe(false);
  });
});

describe("resolvePolicy", () => {
  it("uses the tenant's own policy when it has one", async () => {
    const queryFn = queryReturning([
      { code: CODE, value: { discountApprovalThresholds: [{ percent: 40, approverRole: "OWNER" }] } },
    ]);
    const policy = await resolvePolicy(queryFn, {
      tenantId: TENANT,
      code: CODE,
      parse: parsePolicy,
      fallback: FALLBACK,
    });
    expect(policy.discountApprovalThresholds[0]?.percent).toBe(40);
  });

  it("falls back to the product default when the tenant has stated nothing", async () => {
    // This is the ordinary case, not the exceptional one: the catalogue
    // installer writes its definitions under the demo tenant, so a real
    // property finds no row. "No policy" meaning "no threshold" would leave the
    // control on in the sample data and off everywhere that moves money.
    const policy = await resolvePolicy(queryReturning([]), {
      tenantId: TENANT,
      code: CODE,
      parse: parsePolicy,
      fallback: FALLBACK,
    });
    expect(policy).toBe(FALLBACK);
  });

  it("treats an explicitly empty value as unset", async () => {
    for (const value of [null, ""]) {
      const policy = await resolvePolicy(queryReturning([{ code: CODE, value }]), {
        tenantId: TENANT,
        code: CODE,
        parse: parsePolicy,
        fallback: FALLBACK,
      });
      expect(policy).toBe(FALLBACK);
    }
  });

  it("accepts a policy that was stored as a JSON string", async () => {
    // Refusing an override because someone quoted their settings blob would be
    // a poor trade.
    const policy = await resolvePolicy(
      queryReturning([
        { code: CODE, value: '{"discountApprovalThresholds":[{"percent":5,"approverRole":"STAFF"}]}' },
      ]),
      { tenantId: TENANT, code: CODE, parse: parsePolicy, fallback: FALLBACK },
    );
    expect(policy.discountApprovalThresholds[0]?.percent).toBe(5);
  });

  it("refuses a stored policy that does not parse, rather than silently defaulting", async () => {
    // Substituting the default here would let a malformed edit quietly relax a
    // threshold a property had deliberately tightened.
    await expect(
      resolvePolicy(
        queryReturning([{ code: CODE, value: { discountApprovalThresholds: "all of them" } }]),
        { tenantId: TENANT, code: CODE, parse: parsePolicy, fallback: FALLBACK },
      ),
    ).rejects.toMatchObject({ code: "OVERRIDE_POLICY_UNREADABLE" });
  });

  it("refuses a stored string that is not JSON at all", async () => {
    await expect(
      resolvePolicy(queryReturning([{ code: CODE, value: "not json {" }]), {
        tenantId: TENANT,
        code: CODE,
        parse: parsePolicy,
        fallback: FALLBACK,
      }),
    ).rejects.toMatchObject({ code: "OVERRIDE_POLICY_UNREADABLE" });
  });

  it("raises a non-retryable CommandError, so the refusal does not burn the ladder", async () => {
    // A settings row will not become well-formed on a retry, and the four-attempt
    // ladder plus a stalled partition is the finding that ladder already had.
    const error = await resolvePolicy(queryReturning([{ code: CODE, value: "not json {" }]), {
      tenantId: TENANT,
      code: CODE,
      parse: parsePolicy,
      fallback: FALLBACK,
    }).catch((err: unknown) => err);
    expect(isCommandError(error)).toBe(true);
    expect((error as { retryable: boolean }).retryable).toBe(false);
  });
});
