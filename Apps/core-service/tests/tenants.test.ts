import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import { query } from "../src/lib/db.js";
import type { FastifyInstance } from "fastify";

describe("Tenants Endpoint", () => {
  let app: FastifyInstance;
  let adminUserId: string | null = null;
  let managerUserId: string | null = null;
  let staffUserId: string | null = null;
  let viewerUserId: string | null = null;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // Find users with different roles
    const adminResult = await query<{ user_id: string }>(
      `SELECT DISTINCT uta.user_id
       FROM public.user_tenant_associations uta
       WHERE uta.role = 'ADMIN'
       AND COALESCE(uta.is_deleted, false) = false
       AND uta.deleted_at IS NULL
       LIMIT 1`,
    );
    if (adminResult.rows.length > 0) {
      adminUserId = adminResult.rows[0].user_id;
    }

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

    const staffResult = await query<{ user_id: string }>(
      `SELECT DISTINCT uta.user_id
       FROM public.user_tenant_associations uta
       WHERE uta.role = 'STAFF'
       AND COALESCE(uta.is_deleted, false) = false
       AND uta.deleted_at IS NULL
       LIMIT 1`,
    );
    if (staffResult.rows.length > 0) {
      staffUserId = staffResult.rows[0].user_id;
    }

    const viewerResult = await query<{ user_id: string }>(
      `SELECT DISTINCT uta.user_id
       FROM public.user_tenant_associations uta
       WHERE uta.role = 'VIEWER'
       AND COALESCE(uta.is_deleted, false) = false
       AND uta.deleted_at IS NULL
       LIMIT 1`,
    );
    if (viewerResult.rows.length > 0) {
      viewerUserId = viewerResult.rows[0].user_id;
    }
  });

  describe("GET /v1/tenants - Positive Cases", () => {
    it("should return tenants for ADMIN user", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=10",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=5",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.length).toBeLessThanOrEqual(5);
    });

    it("should use default limit of 50", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.length).toBeLessThanOrEqual(50);
    });

    it("should return tenant with all expected fields", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=1",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      if (payload.length > 0) {
        const tenant = payload[0];
        expect(tenant).toHaveProperty("id");
        expect(tenant).toHaveProperty("name");
        expect(tenant).toHaveProperty("slug");
        expect(tenant).toHaveProperty("type");
        expect(tenant).toHaveProperty("status");
        expect(tenant).toHaveProperty("email");
        expect(tenant).toHaveProperty("property_count");
        expect(tenant).toHaveProperty("user_count");
        expect(tenant).toHaveProperty("active_properties");
      }
    });
  });

  describe("GET /v1/tenants - Negative Cases", () => {
    it("should reject unauthenticated requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject MANAGER role (insufficient privilege)", async () => {
      if (!managerUserId) {
        console.warn("⚠ Skipping test: no MANAGER users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: {
          "x-user-id": managerUserId,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject STAFF role (insufficient privilege)", async () => {
      if (!staffUserId) {
        console.warn("⚠ Skipping test: no STAFF users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: {
          "x-user-id": staffUserId,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject VIEWER role (insufficient privilege)", async () => {
      if (!viewerUserId) {
        console.warn("⚠ Skipping test: no VIEWER users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: {
          "x-user-id": viewerUserId,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject invalid limit (non-numeric)", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=abc",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject limit exceeding maximum", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=101",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject negative limit", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=-5",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject zero limit", async () => {
      if (!adminUserId) {
        console.warn("⚠ Skipping test: no ADMIN users in database");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=0",
        headers: {
          "x-user-id": adminUserId,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject user with no tenant memberships", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: {
          "x-user-id": fakeUserId,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /v1/tenants - Specific User Tests", () => {
    const specificUserId = "019a4887-5225-7001-9855-51992112507c";

    it("should return tenants for specific ADMIN user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: {
          "x-user-id": specificUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBeGreaterThan(0);
    });

    it("should respect custom limit for specific user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=25",
        headers: {
          "x-user-id": specificUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBeLessThanOrEqual(25);
    });

    it("should return tenants with all required fields", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=1",
        headers: {
          "x-user-id": specificUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.length).toBeGreaterThan(0);

      const tenant = payload[0];
      expect(tenant).toHaveProperty("id");
      expect(tenant).toHaveProperty("name");
      expect(tenant).toHaveProperty("slug");
      expect(tenant).toHaveProperty("type");
      expect(tenant).toHaveProperty("status");
      expect(tenant).toHaveProperty("property_count");
      expect(tenant).toHaveProperty("user_count");
    });

    it("should return tenants with valid status values", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=5",
        headers: {
          "x-user-id": specificUserId,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "TRIAL"];
      payload.forEach((tenant: any) => {
        expect(validStatuses).toContain(tenant.status);
      });
    });
  });
});
