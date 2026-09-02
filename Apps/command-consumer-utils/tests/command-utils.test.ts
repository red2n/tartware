import { describe, expect, it } from "vitest";

import {
  assertForcedOverrideAuthority,
  forcedOverrideMinRole,
  resolveActorId,
  resolveActorRole,
  SYSTEM_ACTOR_ID,
  SYSTEM_ACTOR_ROLE,
} from "../src/command-utils.js";

const USER = "44444444-4444-4444-4444-444444444444";

describe("resolveActorRole", () => {
  it("returns the role the gateway stamped on the envelope", () => {
    expect(resolveActorRole({ role: "MANAGER" })).toBe("MANAGER");
    expect(resolveActorRole({ role: "OWNER" })).toBe("OWNER");
  });

  it("falls back to SYSTEM for a command with no membership behind it", () => {
    // Scheduler jobs, replays and internal dispatches carry no initiator.
    expect(resolveActorRole(undefined)).toBe(SYSTEM_ACTOR_ROLE);
    expect(resolveActorRole(null)).toBe(SYSTEM_ACTOR_ROLE);
    expect(resolveActorRole({})).toBe(SYSTEM_ACTOR_ROLE);
  });

  it("refuses a value that is not a role the product defines", () => {
    // The literals this replaced. Passing one through would put the same
    // fiction back into role_at_approval by a different route.
    expect(resolveActorRole({ role: "FORCE_OVERRIDE" })).toBe(SYSTEM_ACTOR_ROLE);
    expect(resolveActorRole({ role: "GM_OVERRIDE" })).toBe(SYSTEM_ACTOR_ROLE);
    expect(resolveActorRole({ role: "GENERAL_MANAGER" })).toBe(SYSTEM_ACTOR_ROLE);
    expect(resolveActorRole({ role: "" })).toBe(SYSTEM_ACTOR_ROLE);
  });

  it("does not name a role the enum defines, so SYSTEM cannot be impersonated", () => {
    expect(resolveActorRole({ role: SYSTEM_ACTOR_ROLE })).toBe(SYSTEM_ACTOR_ROLE);
  });
});

describe("resolveActorId", () => {
  it("keeps the pairing with resolveActorRole intact", () => {
    const initiatedBy = { userId: USER, role: "STAFF" };
    expect(resolveActorId(initiatedBy)).toBe(USER);
    expect(resolveActorRole(initiatedBy)).toBe("STAFF");
  });

  it("falls back to the system sentinel on a non-UUID actor", () => {
    expect(resolveActorId({ userId: "COMMAND_CENTER" })).toBe(SYSTEM_ACTOR_ID);
  });
});

describe("forcedOverrideMinRole — what a `force` flag actually costs (A08)", () => {
  const reason = (over: Record<string, unknown> = {}) =>
    ({
      reason_id: "11111111-1111-1111-1111-111111111111",
      reason_code: "RM_VIP",
      reason_name: "VIP Accommodation",
      reason_category: "ROOM_MOVE",
      requires_approval: false,
      approval_level: "NONE",
      has_financial_impact: false,
      ...over,
      // biome-ignore lint/suspicious/noExplicitAny: a reason row fixture.
    }) as any;

  it("demands nothing for a routine code", () => {
    // Six of the seven seeded ROOM_MOVE codes are exactly this. Gating them
    // would be theatre, not control.
    expect(forcedOverrideMinRole(reason())).toBeNull();
  });

  it("demands a manager when the code says a sign-off is needed", () => {
    // This is the finding itself: `requires_approval` meant "someone senior has
    // to agree" and its escape hatch was a boolean the same person set.
    expect(forcedOverrideMinRole(reason({ requires_approval: true }))).toBe("MANAGER");
  });

  it("honours approval_level whether or not the code is forced", () => {
    expect(forcedOverrideMinRole(reason({ approval_level: "GM" }))).toBe("OWNER");
  });

  it("takes the higher of the two demands", () => {
    expect(
      forcedOverrideMinRole(reason({ requires_approval: true, approval_level: "GM" })),
    ).toBe("OWNER");
    // …and does not let requires_approval *lower* a code that already asks more.
    expect(
      forcedOverrideMinRole(reason({ requires_approval: true, approval_level: "DIRECTOR" })),
    ).toBe("ADMIN");
  });

  it("throws on a level no mapping covers, rather than reading it as no demand", () => {
    expect(() => forcedOverrideMinRole(reason({ approval_level: "REGIONAL_VP" }))).toThrow();
  });
});

describe("assertForcedOverrideAuthority", () => {
  const reason = (over: Record<string, unknown> = {}) =>
    ({
      reason_id: "11111111-1111-1111-1111-111111111111",
      reason_code: "RM_VIP",
      reason_name: "VIP Accommodation",
      reason_category: "ROOM_MOVE",
      requires_approval: true,
      approval_level: "MANAGER",
      has_financial_impact: false,
      ...over,
      // biome-ignore lint/suspicious/noExplicitAny: a reason row fixture.
    }) as any;

  const ctx = { commandName: "reservation.room_move", gateName: "room_move" };

  it("passes an actor who clears the demand", () => {
    expect(() => assertForcedOverrideAuthority(reason(), "MANAGER", ctx)).not.toThrow();
    expect(() => assertForcedOverrideAuthority(reason(), "OWNER", ctx)).not.toThrow();
  });

  it("refuses one who does not, naming what was needed", () => {
    expect(() => assertForcedOverrideAuthority(reason(), "STAFF", ctx)).toThrow(/MANAGER/);
  });

  it("refuses a scheduler or replay", () => {
    // SYSTEM is deliberately not a member of TenantRoleEnum, so it scores
    // nothing — an unattended actor must not force past a control.
    expect(() => assertForcedOverrideAuthority(reason(), SYSTEM_ACTOR_ROLE, ctx)).toThrow();
    expect(() => assertForcedOverrideAuthority(reason(), undefined, ctx)).toThrow();
  });

  it("reports an unenforceable level as its own refusal", () => {
    expect(() =>
      assertForcedOverrideAuthority(reason({ approval_level: "REGIONAL_VP" }), "OWNER", ctx),
    ).toThrow(/not a level this product can enforce/);
  });

  it("raises refusals that do not burn the retry ladder", () => {
    // A clerk's role will not change between attempt one and attempt four.
    try {
      assertForcedOverrideAuthority(reason(), "STAFF", ctx);
      throw new Error("expected a refusal");
    } catch (error) {
      expect((error as { retryable?: boolean }).retryable).toBe(false);
    }
  });
});
