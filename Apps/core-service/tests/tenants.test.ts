import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";
import { TEST_USER_ID, MANAGER_USER_ID, STAFF_USER_ID, VIEWER_USER_ID } from "./mocks/db.js";
import { buildAuthHeader } from "./utils/auth.js";

describe("Tenants Endpoint", () => {
  let app: FastifyInstance;
  // Use role-specific user IDs
  const adminUserId = TEST_USER_ID;
  const managerUserId = MANAGER_USER_ID;
  const staffUserId = STAFF_USER_ID;
  const viewerUserId = VIEWER_USER_ID;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  describe("GET /v1/tenants - Positive Cases", () => {
    it("should return tenants for ADMIN user", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=10",
        headers: buildAuthHeader(adminUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("should respect limit parameter", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=5",
        headers: buildAuthHeader(adminUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.length).toBeLessThanOrEqual(5);
    });

    it("should use default limit of 50", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader(adminUserId),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.length).toBeLessThanOrEqual(50);
    });

    it("should return tenant with all expected fields", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=1",
        headers: buildAuthHeader(adminUserId),
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

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader(managerUserId),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject STAFF role (insufficient privilege)", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader(staffUserId),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject VIEWER role (insufficient privilege)", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader(viewerUserId),
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject invalid limit (non-numeric)", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=abc",
        headers: buildAuthHeader(adminUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject limit exceeding maximum", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=101",
        headers: buildAuthHeader(adminUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject negative limit", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=-5",
        headers: buildAuthHeader(adminUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject zero limit", async () => {

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=0",
        headers: buildAuthHeader(adminUserId),
      });

      expect(response.statusCode).toBe(400);
    });

    it("should reject user with no tenant memberships", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";

      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader(fakeUserId),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /v1/tenants - Specific User Tests", () => {
    const specificUserId = TEST_USER_ID; // Use test user from mocks

    it("should return tenants for specific ADMIN user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader(specificUserId),
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
        headers: buildAuthHeader(specificUserId),
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
        headers: buildAuthHeader(specificUserId),
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
        headers: buildAuthHeader(specificUserId),
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
