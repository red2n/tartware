import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import { query } from "../src/lib/db.js";
import type { FastifyInstance } from "fastify";
import { buildAuthHeader } from "./utils/auth.js";
import {
  MANAGER_USER_ID,
  STAFF_USER_ID,
  TEST_TENANT_ID,
  VIEWER_USER_ID,
} from "./mocks/db.js";

describe("Guests Endpoint", () => {
  let app: FastifyInstance;
  let staffUserId: string | null = null;
  let staffTenantId: string | null = null;
  let managerUserId: string | null = null;
  let managerTenantId: string | null = null;
  let viewerUserId: string | null = null;
  let otherTenantId: string | null = null;
  let testGuestEmail: string | null = null;
  let testGuestPhone: string | null = null;

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

    // Get MANAGER user
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

    // Get different tenant
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

    // Get a guest for filter tests
    if (staffTenantId) {
      const guestResult = await query<{ email: string; phone: string | null }>(
        `SELECT email, phone
         FROM public.guests
         WHERE tenant_id = $1
         AND COALESCE(is_deleted, false) = false
         AND deleted_at IS NULL
         LIMIT 1`,
        [staffTenantId],
      );
      if (guestResult.rows.length > 0) {
        testGuestEmail = guestResult.rows[0]?.email ?? null;
        testGuestPhone = guestResult.rows[0]?.phone ?? null;
      }
    }

    staffUserId = staffUserId ?? STAFF_USER_ID;
    staffTenantId = staffTenantId ?? TEST_TENANT_ID;
    managerUserId = managerUserId ?? MANAGER_USER_ID;
    managerTenantId = managerTenantId ?? TEST_TENANT_ID;
    viewerUserId = viewerUserId ?? VIEWER_USER_ID;
  });

  describe("GET /v1/guests - Positive Cases", () => {
    it("should reject STAFF user with valid tenant_id due to insufficient role", async () => {
      if (!staffUserId || !staffTenantId) {
        console.warn("⚠ Skipping test: no STAFF users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${staffTenantId}&limit=10`,
        headers: buildAuthHeader(staffUserId),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return guests for MANAGER user", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&limit=10`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should filter by email", async () => {
      if (!managerUserId || !managerTenantId || !testGuestEmail) {
        console.warn("⚠ Skipping test: missing test data");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&email=${encodeURIComponent(testGuestEmail.substring(0, 5))}`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should filter by phone", async () => {
      if (!managerUserId || !managerTenantId || !testGuestPhone) {
        console.warn("⚠ Skipping test: missing test data");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&phone=${encodeURIComponent(testGuestPhone.substring(0, 5))}`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
    });

    it("should filter by vip_status", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&vip_status=true`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should filter by is_blacklisted", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&is_blacklisted=false`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
    });

    it("should filter by loyalty_tier", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&loyalty_tier=GOLD`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
    });

    it("should return guest with expected fields", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&limit=1`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);

      if (payload.length > 0) {
        const guest = payload[0];
        expect(guest).toHaveProperty("id");
        expect(guest).toHaveProperty("tenant_id");
        expect(guest).toHaveProperty("first_name");
        expect(guest).toHaveProperty("last_name");
        expect(guest).toHaveProperty("email");
        expect(guest).toHaveProperty("vip_status");
        expect(guest).toHaveProperty("loyalty_points");
      }
    });

    it("should respect limit parameter", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&limit=3`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.length).toBeLessThanOrEqual(3);
    });
  });

  describe("GET /v1/guests - Negative Cases", () => {
    it("should reject unauthenticated request", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/guests?tenant_id=00000000-0000-0000-0000-000000000000",
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
        url: "/v1/guests",
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
        url: "/v1/guests?tenant_id=not-a-valid-uuid",
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
        url: `/v1/guests?tenant_id=${staffTenantId}`,
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
        url: `/v1/guests?tenant_id=${otherTenantId}`,
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
        url: `/v1/guests?tenant_id=${managerTenantId}&limit=-10`,
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
        url: `/v1/guests?tenant_id=${managerTenantId}&limit=0`,
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
        url: `/v1/guests?tenant_id=${managerTenantId}&limit=200`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid email filter (too short)", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&email=ab`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject invalid phone filter (too short)", async () => {
      if (!managerUserId || !managerTenantId) {
        console.warn("⚠ Skipping test: no MANAGER users with tenants");
        return;
      }

      const response = await app.inject({
        method: "GET",
        url: `/v1/guests?tenant_id=${managerTenantId}&phone=12`,
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
