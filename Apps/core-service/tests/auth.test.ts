import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import { query } from "../src/lib/db.js";
import type { FastifyInstance } from "fastify";

describe("Auth Context Endpoint", () => {
  let app: FastifyInstance;
  let testUserId: string | null = null;
  let testTenantId: string | null = null;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // Get a real user from the database
    const userResult = await query<{ id: string }>(
      `SELECT id FROM public.users
       WHERE COALESCE(is_deleted, false) = false
       AND deleted_at IS NULL
       LIMIT 1`,
    );

    if (userResult.rows.length > 0) {
      testUserId = userResult.rows[0].id;
    }

    // Get a real tenant
    const tenantResult = await query<{ id: string }>(
      `SELECT id FROM public.tenants
       WHERE COALESCE(is_deleted, false) = false
       AND deleted_at IS NULL
       LIMIT 1`,
    );

    if (tenantResult.rows.length > 0) {
      testTenantId = tenantResult.rows[0].id;
    }
  });

  describe("GET /v1/auth/context - Unauthenticated", () => {
    it("should return unauthenticated context without header", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(false);
      expect(payload.user_id).toBeNull();
      expect(payload.memberships).toEqual([]);
      expect(payload.authorized_tenants).toEqual([]);
    });

    it("should return header hint for authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
      });

      const payload = JSON.parse(response.payload);
      expect(payload.header_hint).toBeDefined();
      expect(payload.header_hint.header).toBe("x-user-id");
      expect(payload.header_hint.description).toContain("x-user-id");
    });

    it("should reject empty x-user-id header", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": "",
        },
      });

      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(false);
      expect(payload.user_id).toBeNull();
    });

    it("should reject whitespace-only x-user-id header", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": "   ",
        },
      });

      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(false);
      expect(payload.user_id).toBeNull();
    });
  });

  describe("GET /v1/auth/context - Authenticated", () => {
    it("should return authenticated context with valid user", async () => {
      if (!testUserId) {
        console.warn("⚠ Skipping test: no users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": testUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(true);
      expect(payload.user_id).toBe(testUserId);
      expect(Array.isArray(payload.memberships)).toBe(true);
    });

    it("should include tenant memberships", async () => {
      if (!testUserId) {
        console.warn("⚠ Skipping test: no users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": testUserId,
        },
      });

      const payload = JSON.parse(response.payload);

      if (payload.memberships.length > 0) {
        const membership = payload.memberships[0];
        expect(membership).toHaveProperty("tenant_id");
        expect(membership).toHaveProperty("role");
        expect(membership).toHaveProperty("is_active");
        expect(membership).toHaveProperty("permissions");
        expect(["OWNER", "ADMIN", "MANAGER", "STAFF", "VIEWER"]).toContain(membership.role);
      }
    });

    it("should handle non-existent user gracefully", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": fakeUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(true);
      expect(payload.user_id).toBe(fakeUserId);
      expect(payload.memberships).toEqual([]);
    });

    it("should trim whitespace from user id", async () => {
      if (!testUserId) {
        console.warn("⚠ Skipping test: no users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": `  ${testUserId}  `,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.user_id).toBe(testUserId);
    });

    it("should return empty authorized_tenants before route guards", async () => {
      if (!testUserId) {
        console.warn("⚠ Skipping test: no users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": testUserId,
        },
      });

      const payload = JSON.parse(response.payload);
      expect(payload.authorized_tenants).toEqual([]);
    });
  });

  describe("GET /v1/auth/context - Specific User Tests", () => {
    const specificUserId = "019a4887-5225-7001-9855-51992112507c";

    it("should return authenticated context for specific user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": specificUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(true);
      expect(payload.user_id).toBe(specificUserId);
    });

    it("should have at least one tenant membership", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": specificUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload.memberships)).toBe(true);
      expect(payload.memberships.length).toBeGreaterThan(0);
    });

    it("should have OWNER or ADMIN role in at least one tenant", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": specificUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      const hasHighRole = payload.memberships.some(
        (m: any) => m.role === "OWNER" || m.role === "ADMIN"
      );
      expect(hasHighRole).toBe(true);
    });

    it("should have active memberships", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          "x-user-id": specificUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      const hasActiveMembership = payload.memberships.some(
        (m: any) => m.is_active === true
      );
      expect(hasActiveMembership).toBe(true);
    });
  });
});
