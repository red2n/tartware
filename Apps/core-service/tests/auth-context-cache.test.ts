import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { buildServer } from "../src/server.js";
import type { CachedMembership } from "../src/services/user-cache-service.js";
import { userCacheService } from "../src/services/user-cache-service.js";
import { TEST_TENANT_ID, TEST_USER_ID } from "./mocks/db.js";
import { buildAuthHeader } from "./utils/auth.js";

const createMembership = (): CachedMembership => ({
  tenant_id: TEST_TENANT_ID,
  tenant_name: "Test Tenant",
  role: "ADMIN",
  is_active: true,
  permissions: {},
  modules: ["core"],
});

describe("Auth context membership caching", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("loads memberships from the cache service with telemetry enabled", async () => {
    const membership = createMembership();
    const getSpy = vi
      .spyOn(userCacheService, "getUserMemberships")
      .mockImplementationOnce(async (userId, options) => {
        options?.telemetry?.({
          userId,
          membershipCount: 1,
          source: "cache",
          durationMs: 3,
        });
        return [membership];
      });
    const fallbackSpy = vi.spyOn(userCacheService, "getUserMembershipsFromDb");

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/context",
      headers: buildAuthHeader(TEST_USER_ID),
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(Array.isArray(payload.memberships)).toBe(true);
    expect(payload.memberships[0]?.tenant_id).toBe(TEST_TENANT_ID);

    expect(getSpy).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ telemetry: expect.any(Function) }),
    );
    expect(fallbackSpy).not.toHaveBeenCalled();
  });

  it("falls back to a direct database lookup when cache loading fails", async () => {
    const membership = createMembership();
    vi.spyOn(userCacheService, "getUserMemberships").mockRejectedValueOnce(new Error("redis down"));
    const fallbackSpy = vi
      .spyOn(userCacheService, "getUserMembershipsFromDb")
      .mockResolvedValueOnce([membership]);

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/context",
      headers: buildAuthHeader(TEST_USER_ID),
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.memberships[0]?.tenant_id).toBe(TEST_TENANT_ID);

    expect(fallbackSpy).toHaveBeenCalledWith(TEST_USER_ID);
  });
});
