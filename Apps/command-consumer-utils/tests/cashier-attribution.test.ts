/**
 * Binding a posting to the drawer it was taken at (A09).
 *
 * `cashier_sessions` could open a shift, hand it over and close it with a
 * counted variance from the day it was written. `charge_postings` carried
 * `cashier_name VARCHAR(100)` — free text, no key to the session, and written
 * by no code path in the repository. So a drawer that closed forty pounds down
 * could be counted and could not be reconciled: nothing knew which forty.
 *
 * The two behaviours worth pinning are both refusals to guess.
 */

import { describe, expect, it, vi } from "vitest";

import {
  recordSupervisorOverride,
  resolveOpenCashierSession,
} from "../src/cashier.js";
import { SYSTEM_ACTOR_ID } from "../src/command-utils.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const ACTOR = "33333333-3333-3333-3333-333333333333";
const SESSION = "44444444-4444-4444-4444-444444444444";

const queryReturning = (rows: { session_id: string }[]) => vi.fn(async () => ({ rows }));

describe("resolveOpenCashierSession", () => {
  it("returns the actor's own open session at that property", async () => {
    const queryFn = queryReturning([{ session_id: SESSION }]);
    await expect(
      resolveOpenCashierSession(queryFn, {
        tenantId: TENANT,
        propertyId: PROPERTY,
        actorId: ACTOR,
      }),
    ).resolves.toBe(SESSION);
  });

  it("matches on the cashier, not merely on the property", async () => {
    // The tempting shortcut was "the property's only open session". Attributing
    // a posting to a drawer its operator was not standing at produces a
    // reconciliation that balances and is wrong, which is worse than one that
    // does not balance.
    const queryFn = queryReturning([]);
    await resolveOpenCashierSession(queryFn, {
      tenantId: TENANT,
      propertyId: PROPERTY,
      actorId: ACTOR,
    });
    const sql = String(queryFn.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("cashier_id = $3::uuid");
    expect(sql).toContain("session_status = 'open'");
  });

  it("returns null when the actor has no drawer open", async () => {
    await expect(
      resolveOpenCashierSession(queryReturning([]), {
        tenantId: TENANT,
        propertyId: PROPERTY,
        actorId: ACTOR,
      }),
    ).resolves.toBeNull();
  });

  it("does not ask at all for a system actor", async () => {
    // A night audit's room-and-tax run has no cashier and never will. Asking
    // would be a query per posting for an answer that is always null.
    const queryFn = queryReturning([{ session_id: SESSION }]);
    await expect(
      resolveOpenCashierSession(queryFn, {
        tenantId: TENANT,
        propertyId: PROPERTY,
        actorId: SYSTEM_ACTOR_ID,
      }),
    ).resolves.toBeNull();
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("does not ask without an actor or a property", async () => {
    const queryFn = queryReturning([{ session_id: SESSION }]);
    await expect(
      resolveOpenCashierSession(queryFn, {
        tenantId: TENANT,
        propertyId: PROPERTY,
        actorId: null,
      }),
    ).resolves.toBeNull();
    await expect(
      resolveOpenCashierSession(queryFn, { tenantId: TENANT, propertyId: "", actorId: ACTOR }),
    ).resolves.toBeNull();
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("ignores an actor id that is not a uuid", async () => {
    const queryFn = queryReturning([{ session_id: SESSION }]);
    await expect(
      resolveOpenCashierSession(queryFn, {
        tenantId: TENANT,
        propertyId: PROPERTY,
        actorId: "COMMAND_CENTER",
      }),
    ).resolves.toBeNull();
    expect(queryFn).not.toHaveBeenCalled();
  });
});

describe("recordSupervisorOverride", () => {
  const captured = () => {
    const seen: { sql: string; params: unknown[] } = { sql: "", params: [] };
    const queryFn = vi.fn(async (sql: string, params: unknown[]) => {
      seen.sql = sql;
      seen.params = params;
      return { rows: [] };
    });
    return { queryFn, seen };
  };

  it("appends rather than replacing, in one statement", async () => {
    // Two overrides on the same drawer at the same moment must not lose each
    // other to a read-modify-write.
    const { queryFn, seen } = captured();
    await recordSupervisorOverride(queryFn, {
      tenantId: TENANT,
      sessionId: SESSION,
      reason: "CL_COMPANY_GUARANTEED: guaranteed by the corporate account",
      amount: 500,
      supervisorId: ACTOR,
    });
    expect(seen.sql).toContain("COALESCE(supervisor_overrides, '[]'::jsonb) || $3::jsonb");
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("writes the shape the column documents", async () => {
    const { queryFn, seen } = captured();
    await recordSupervisorOverride(queryFn, {
      tenantId: TENANT,
      sessionId: SESSION,
      reason: "CL_LIMIT_UNDER_REVIEW: credit review in progress",
      amount: 500,
      supervisorId: ACTOR,
    });
    const entry = JSON.parse(String(seen.params[2]))[0];
    expect(Object.keys(entry).sort()).toEqual([
      "amount",
      "reason",
      "supervisor_id",
      "timestamp",
    ]);
    expect(entry.amount).toBe(500);
    expect(entry.supervisor_id).toBe(ACTOR);
  });

  it("only touches an open session", async () => {
    // An override recorded after the drawer closed would change a total someone
    // has already reconciled.
    const { queryFn, seen } = captured();
    await recordSupervisorOverride(queryFn, {
      tenantId: TENANT,
      sessionId: SESSION,
      reason: "r",
      amount: null,
      supervisorId: null,
    });
    expect(seen.sql).toContain("session_status = 'open'");
    expect(seen.sql).toContain("tenant_id = $1::uuid");
  });
});
