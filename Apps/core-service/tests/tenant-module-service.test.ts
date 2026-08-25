import { beforeEach, describe, expect, it, vi } from "vitest";

import { query } from "../src/lib/db.js";
import { emitMembershipCacheInvalidation } from "../src/services/membership-cache-hooks.js";
import { updateTenantModules } from "../src/services/tenant-module-service.js";

vi.mock("../src/services/membership-cache-hooks.js", () => ({
  emitMembershipCacheInvalidation: vi.fn(async () => undefined),
}));

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USER_A = "33333333-3333-3333-3333-333333333333";
const USER_B = "44444444-4444-4444-4444-444444444444";

const mockedQuery = vi.mocked(query);
const mockedEmit = vi.mocked(emitMembershipCacheInvalidation);

/** Route the two writes updateTenantModules performs, returning the given members. */
const stubWrites = (userIds: string[]) => {
  mockedQuery.mockImplementation((async (text: string) => {
    const rows = text.includes("user_tenant_associations")
      ? userIds.map((user_id) => ({ user_id }))
      : [];
    return { rows, rowCount: rows.length, command: "UPDATE", oid: 0, fields: [] };
  }) as unknown as typeof query);
};

describe("updateTenantModules", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedEmit.mockClear();
  });

  it("invalidates the membership cache for every affected member", async () => {
    stubWrites([USER_A, USER_B]);

    await updateTenantModules(TENANT_ID, ["core", "analytics-bi"]);

    // Without this the auth context keeps serving the pre-update module list
    // from cache, so every gated route answers TENANT_MODULE_NOT_ENABLED even
    // though the write succeeded and the endpoint returned 200.
    expect(mockedEmit).toHaveBeenCalledTimes(2);
    expect(mockedEmit.mock.calls.map(([event]) => event.userId).sort()).toEqual(
      [USER_A, USER_B].sort(),
    );
    for (const [event] of mockedEmit.mock.calls) {
      expect(event.reason).toBe("TENANT_MEMBERSHIP_MUTATED");
    }
  });

  it("persists the module list and always includes core", async () => {
    stubWrites([USER_A]);

    const result = await updateTenantModules(TENANT_ID, ["analytics-bi"]);

    expect(result.tenantId).toBe(TENANT_ID);
    expect(result.modules).toContain("core");
    expect(result.modules).toContain("analytics-bi");
  });

  it("emits nothing when the tenant has no members to invalidate", async () => {
    stubWrites([]);

    await updateTenantModules(TENANT_ID, ["core"]);

    expect(mockedEmit).not.toHaveBeenCalled();
  });
});
