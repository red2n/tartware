import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import { query } from "../src/lib/db.js";
import type { FastifyInstance } from "fastify";

describe("User-Tenant Associations Endpoint", () => {
  let app: FastifyInstance;
  let adminUserId: string | null = null;
  let adminTenantId: string | null = null;
  let ownerUserId: string | null = null;
  let ownerTenantId: string | null = null;
  let managerUserId: string | null = null;
  let otherTenantId: string | null = null;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // Get ADMIN user with tenant
    const adminResult = await query<{ user_id: string; tenant_id: string }>(
      `SELECT DISTINCT uta.user_id, uta.tenant_id
       FROM public.user_tenant_associations uta
       WHERE uta.role = 'ADMIN'
       AND uta.is_active = true
       AND COALESCE(uta.is_deleted, false) = false
       AND uta.deleted_at IS NULL
       LIMIT 1`,
    );
    if (adminResult.rows.length > 0) {
      adminUserId = adminResult.rows[0].user_id;
      adminTenantId = adminResult.rows[0].tenant_id;
    }

    // Get OWNER user with tenant
    const ownerResult = await query<{ user_id: string; tenant_id: string }>(
      `SELECT DISTINCT uta.user_id, uta.tenant_id
       FROM public.user_tenant_associations uta
       WHERE uta.role = 'OWNER'
       AND uta.is_active = true
       AND COALESCE(uta.is_deleted, false) = false
       AND uta.deleted_at IS NULL
       LIMIT 1`,
    );
    if (ownerResult.rows.length > 0) {
      ownerUserId = ownerResult.rows[0].user_id;
      ownerTenantId = ownerResult.rows[0].tenant_id;
    }

    // Get MANAGER user
    const managerResult = await query<{ user_id: string }>(
      `SELECT DISTINCT uta.user_id
       FROM public.user_tenant_associations uta
       WHERE uta.role = 'MANAGER'
       AND COALESCE(uta.is_deleted, false) = false
       AND uta.deleted_at IS NULL
       LIMIT 1`,
    );
    if (managerResult.rows.length > 0) {
      managerUserId = managerResult.rows[0].user_id;
    }

    // Get different tenant
    const otherTenantResult = await query<{ id: string }>(
      `SELECT t.id
       FROM public.tenants t
       WHERE t.id != $1
       AND COALESCE(t.is_deleted, false) = false
       AND t.deleted_at IS NULL
       LIMIT 1`,
      [adminTenantId ?? "00000000-0000-0000-0000-000000000000"],
    );
    if (otherTenantResult.rows.length > 0) {
      otherTenantId = otherTenantResult.rows[0].id;
    }
  });

  describe("GET /v1/user-tenant-associations - Positive Cases", () => {
    it("should return associations for ADMIN with valid tenant_id", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&limit=10`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should return associations for OWNER", async () => {
      if (!ownerUserId || !ownerTenantId) {
        console.warn("⚠ Skipping test: no OWNER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${ownerTenantId}&limit=10`,
        headers: {
          "x-user-id": ownerUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should filter by user_id", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&user_id=${adminUserId}`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);

      if (payload.length > 0) {
        expect(payload.every((assoc: { user_id: string }) => assoc.user_id === adminUserId)).toBe(true);
      }
    });

    it("should filter by role", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&role=STAFF`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);

      if (payload.length > 0) {
        expect(payload.every((assoc: { role: string }) => assoc.role === "STAFF")).toBe(true);
      }
    });

    it("should filter by is_active", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&is_active=true`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should return association with expected fields", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&limit=1`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      if (payload.length > 0) {
        const assoc = payload[0];
        expect(assoc).toHaveProperty("id");
        expect(assoc).toHaveProperty("user_id");
        expect(assoc).toHaveProperty("tenant_id");
        expect(assoc).toHaveProperty("role");
        expect(assoc).toHaveProperty("is_active");
        expect(assoc).toHaveProperty("permissions");
        expect(["OWNER", "ADMIN", "MANAGER", "STAFF", "VIEWER"]).toContain(assoc.role);
      }
    });

    it("should include user details when available", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&limit=1`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      if (payload.length > 0 && payload[0].user) {
        const user = payload[0].user;
        expect(user).toHaveProperty("username");
        expect(user).toHaveProperty("email");
      }
    });

    it("should respect limit parameter", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&limit=2`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.length).toBeLessThanOrEqual(2);
    });
  });

  describe("GET /v1/user-tenant-associations - Negative Cases", () => {
    it("should reject unauthenticated request", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/user-tenant-associations?tenant_id=00000000-0000-0000-0000-000000000000",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject request without tenant_id", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/user-tenant-associations",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid tenant_id format", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/user-tenant-associations?tenant_id=invalid-format",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject MANAGER role (insufficient privilege)", async () => {
      if (!managerUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users or tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}`,
        headers: {
          "x-user-id": managerUserId,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject access to unauthorized tenant", async () => {
      if (!adminUserId || !otherTenantId) {
        console.warn("⚠ Skipping test: missing test data");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${otherTenantId}`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject invalid role filter", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&role=INVALID_ROLE`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid user_id format", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&user_id=not-a-uuid`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject negative limit", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&limit=-5`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject zero limit", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&limit=0`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject limit exceeding maximum", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/user-tenant-associations?tenant_id=${adminTenantId}&limit=150`,
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
