import { describe, expect, it } from "vitest";

import {
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
