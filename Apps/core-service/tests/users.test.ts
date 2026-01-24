import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import { query } from "../src/lib/db.js";
import type { FastifyInstance } from "fastify";
import { buildAuthHeader } from "./utils/auth.js";

describe("Users Endpoint", () => {
  let app: FastifyInstance;
  let managerUserId: string | null = null;
  let managerTenantId: string | null = null;
  let adminUserId: string | null = null;
  let adminTenantId: string | null = null;
  let staffUserId: string | null = null;
  let staffTenantId: string | null = null;
  let otherTenantId: string | null = null;
  let createdUserId: string | null = null;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // Get MANAGER user with tenant
    const managerResult = await query<{ user_id: string; tenant_id: string }>(
      `SELECT DISTINCT uta.user_id, uta.tenant_id
       FROM public.user_tenant_associations uta
       WHERE uta.role = 'MANAGER'
       AND uta.is_active = true
       AND COALESCE(uta.is_deleted, false) = false
       AND uta.deleted_at IS NULL
       LIMIT 1`,
    );
    if (managerResult.rows.length > 0) {
      managerUserId = managerResult.rows[0]?.user_id ?? null;
      managerTenantId = managerResult.rows[0]?.tenant_id ?? null;
    }

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

    // Get STAFF user with tenant
    const staffResult = await query<{ user_id: string; tenant_id: string }>(
      `SELECT DISTINCT uta.user_id, uta.tenant_id
       FROM public.user_tenant_associations uta
       WHERE uta.role = 'STAFF'
       AND uta.is_active = true
       AND COALESCE(uta.is_deleted, false) = false
       AND uta.deleted_at IS NULL
       LIMIT 1`,
    );
    if (staffResult.rows.length > 0) {
      staffUserId = staffResult.rows[0]?.user_id ?? null;
      staffTenantId = staffResult.rows[0]?.tenant_id ?? null;
    }

    // Get different tenant for unauthorized tests
    const otherTenantResult = await query<{ id: string }>(
      `SELECT t.id
       FROM public.tenants t
       WHERE t.id != $1
       AND COALESCE(t.is_deleted, false) = false
       AND t.deleted_at IS NULL
       LIMIT 1`,
      [managerTenantId ?? "00000000-0000-0000-0000-000000000000"],
    );
    if (otherTenantResult.rows.length > 0) {
      otherTenantId = otherTenantResult.rows[0]?.id ?? null;
    }
  });

  describe("GET /v1/users - Positive Cases", () => {
    it("should return users for MANAGER with valid tenant_id", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${managerTenantId}&limit=10`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should return users for ADMIN", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${adminTenantId}&limit=10`,
        headers: buildAuthHeader(adminUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${managerTenantId}&limit=2`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.length).toBeLessThanOrEqual(2);
    });

    it("should return user with expected fields", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${managerTenantId}&limit=1`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      if (payload.length > 0) {
        const user = payload[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("username");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("first_name");
        expect(user).toHaveProperty("last_name");
        expect(user).toHaveProperty("is_active");
        expect(typeof user.version === "string").toBe(true);
      }
    });

    it("should return sanitized payload without embedding tenant associations", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${managerTenantId}&limit=1`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      if (payload.length > 0) {
        const user = payload[0];
        expect(user.tenants).toBeUndefined();
      }
    });
  });

  describe("GET /v1/users - Negative Cases", () => {
    it("should reject unauthenticated request", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/users?tenant_id=00000000-0000-0000-0000-000000000000",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject request without tenant_id", async () => {
      if (!managerUserId) {
        console.warn("⚠ Skipping test: no MANAGER users");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/users",
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid tenant_id format", async () => {
      if (!managerUserId) {
        console.warn("⚠ Skipping test: no MANAGER users");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/users?tenant_id=not-a-uuid",
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject STAFF role (insufficient privilege)", async () => {
      if (!staffUserId || !staffTenantId) {
        console.warn("⚠ Skipping test: no STAFF users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${staffTenantId}`,
        headers: buildAuthHeader(staffUserId),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject access to unauthorized tenant", async () => {
      if (!managerUserId || !otherTenantId) {
        console.warn("⚠ Skipping test: missing test data");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${otherTenantId}`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject negative limit", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${managerTenantId}&limit=-5`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject zero limit", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${managerTenantId}&limit=0`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject limit exceeding maximum", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/users?tenant_id=${managerTenantId}&limit=150`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /v1/users - Tenant Admin Cases", () => {
    it("should allow ADMIN to create a tenant user", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      const uniqueId = randomUUID().slice(0, 8);
      const payload = {
        tenant_id: adminTenantId,
        username: `tenant_user_${uniqueId}`,
        email: `tenant_user_${uniqueId}@example.com`,
        password: "TempPass123!",
        first_name: "Tenant",
        last_name: "User",
        role: "STAFF",
      };

      const response = await app.inject({
        method: "POST",
        url: "/v1/users",
        headers: buildAuthHeader(adminUserId),
        payload,
      });

      expect(response.statusCode).toBe(201);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("email", payload.email);
      createdUserId = result.id;
    });

    it("should allow ADMIN to reset a tenant user's password", async () => {
      if (!adminUserId || !adminTenantId) {
        console.warn("⚠ Skipping test: no ADMIN users with tenants");
        return;
      }

      if (!createdUserId) {
        console.warn("⚠ Skipping test: missing created user");
        return;
      }

      const response = await app.inject({
        method: "POST",
        url: "/v1/users/reset-password",
        headers: buildAuthHeader(adminUserId),
        payload: {
          tenant_id: adminTenantId,
          user_id: createdUserId,
          new_password: "ResetPass123!",
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty("user_id", createdUserId);
    });
  });
});
