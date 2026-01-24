import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import { query } from "../src/lib/db.js";
import type { FastifyInstance } from "fastify";
import { buildAuthHeader } from "./utils/auth.js";
import { hashPassword } from "../src/utils/password.js";

describe("User-Tenant Associations Endpoint", () => {
  let app: FastifyInstance;
  let adminUserId: string | null = null;
  let adminTenantId: string | null = null;
  let ownerUserId: string | null = null;
  let ownerTenantId: string | null = null;
  let managerUserId: string | null = null;
  let otherTenantId: string | null = null;
  let managedUserId: string | null = null;

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
      adminUserId = adminResult.rows[0]?.user_id ?? null;
      adminTenantId = adminResult.rows[0]?.tenant_id ?? null;
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
      ownerUserId = ownerResult.rows[0]?.user_id ?? null;
      ownerTenantId = ownerResult.rows[0]?.tenant_id ?? null;
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
      managerUserId = managerResult.rows[0]?.user_id ?? null;
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
      otherTenantId = otherTenantResult.rows[0]?.id ?? null;
    }

    if (adminUserId && adminTenantId) {
      const uniqueId = randomUUID().slice(0, 8);
      const passwordHash = await hashPassword("TempPass123!");
      const userResult = await query<{ id: string }>(
        `INSERT INTO users
          (username, email, password_hash, first_name, last_name, is_active, is_verified, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, true, false, $6, $6)
         RETURNING id`,
        [
          `assoc_user_${uniqueId}`,
          `assoc_user_${uniqueId}@example.com`,
          passwordHash,
          "Assoc",
          "User",
          adminUserId,
        ],
      );

      managedUserId = userResult.rows[0]?.id ?? null;
      if (managedUserId) {
        await query(
          `INSERT INTO user_tenant_associations (user_id, tenant_id, role, is_active)
           VALUES ($1, $2, 'STAFF', true)`,
          [managedUserId, adminTenantId],
        );
      }
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(ownerUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(managerUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
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
        headers: buildAuthHeader(adminUserId),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /v1/user-tenant-associations - Tenant Admin Cases", () => {
    it("should allow ADMIN to update a user's role", async () => {
      if (!adminUserId || !adminTenantId || !managedUserId) {
        console.warn("⚠ Skipping test: missing admin or managed user");
        return;
      }

      const response = await app.inject({
        method: "POST",
        url: "/v1/user-tenant-associations/role",
        headers: buildAuthHeader(adminUserId),
        payload: {
          tenant_id: adminTenantId,
          user_id: managedUserId,
          role: "MANAGER",
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty("role", "MANAGER");
    });

    it("should allow ADMIN to deactivate a user's tenant access", async () => {
      if (!adminUserId || !adminTenantId || !managedUserId) {
        console.warn("⚠ Skipping test: missing admin or managed user");
        return;
      }

      const response = await app.inject({
        method: "POST",
        url: "/v1/user-tenant-associations/status",
        headers: buildAuthHeader(adminUserId),
        payload: {
          tenant_id: adminTenantId,
          user_id: managedUserId,
          is_active: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty("is_active", false);
    });
  });
});
