import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import { query } from "../src/lib/db.js";
import type { FastifyInstance } from "fastify";
import { buildAuthHeader } from "./utils/auth.js";

describe("Properties Endpoint", () => {
  let app: FastifyInstance;
  let staffUserId: string | null = null;
  let staffTenantId: string | null = null;
  let managerUserId: string | null = null;
  let managerTenantId: string | null = null;
  let viewerUserId: string | null = null;
  let otherTenantId: string | null = null;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

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

    // Get VIEWER user
    const viewerResult = await query<{ user_id: string }>(
      `SELECT DISTINCT uta.user_id
       FROM public.user_tenant_associations uta
       WHERE uta.role = 'VIEWER'
       AND COALESCE(uta.is_deleted, false) = false
       AND uta.deleted_at IS NULL
       LIMIT 1`,
    );
    if (viewerResult.rows.length > 0) {
      viewerUserId = viewerResult.rows[0]?.user_id ?? null;
    }

    // Get a different tenant for unauthorized tests
    const otherTenantResult = await query<{ id: string }>(
      `SELECT t.id
       FROM public.tenants t
       WHERE t.id != $1
       AND COALESCE(t.is_deleted, false) = false
       AND t.deleted_at IS NULL
       LIMIT 1`,
      [staffTenantId ?? "00000000-0000-0000-0000-000000000000"],
    );
    if (otherTenantResult.rows.length > 0) {
      otherTenantId = otherTenantResult.rows[0]?.id ?? null;
    }
  });

  describe("GET /v1/properties - Positive Cases", () => {
    it("should reject STAFF user with valid tenant_id due to insufficient role", async () => {
      if (!staffUserId || !staffTenantId) {
        console.warn("⚠ Skipping test: no STAFF users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/properties?tenant_id=${staffTenantId}&limit=10`,
        headers: buildAuthHeader(staffUserId),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return properties for MANAGER user", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/properties?tenant_id=${managerTenantId}&limit=10`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
    });

    it("should respect limit parameter", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/properties?tenant_id=${managerTenantId}&limit=3`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.length).toBeLessThanOrEqual(3);
    });

    it("should return property with expected fields", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/properties?tenant_id=${managerTenantId}&limit=1`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      if (payload.length > 0) {
        const property = payload[0];
        expect(property).toHaveProperty("id");
        expect(property).toHaveProperty("tenant_id");
        expect(property).toHaveProperty("property_name");
        expect(property).toHaveProperty("property_code");
        expect(property).toHaveProperty("total_rooms");
        expect(property).toHaveProperty("room_count");
      }
    });
  });

  describe("GET /v1/properties - Negative Cases", () => {
    it("should reject request without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/properties?tenant_id=00000000-0000-0000-0000-000000000000",
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
        url: "/v1/properties",
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
        url: "/v1/properties?tenant_id=invalid-uuid",
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject VIEWER role (insufficient privilege)", async () => {
      if (!viewerUserId || !staffTenantId) {
        console.warn("⚠ Skipping test: no VIEWER users or tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/properties?tenant_id=${staffTenantId}`,
        headers: buildAuthHeader(viewerUserId),
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
        url: `/v1/properties?tenant_id=${otherTenantId}`,
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
        url: `/v1/properties?tenant_id=${managerTenantId}&limit=-1`,
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
        url: `/v1/properties?tenant_id=${managerTenantId}&limit=101`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject non-existent tenant for user", async () => {
      if (!managerUserId) {
        console.warn("⚠ Skipping test: no MANAGER users");
        return;
      }

      const nonExistentTenant = "99999999-9999-9999-9999-999999999999";

      const response = await app.inject({
        method: "GET",
        url: `/v1/properties?tenant_id=${nonExistentTenant}`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
