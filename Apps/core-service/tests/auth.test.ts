import type { FastifyInstance } from "fastify";
import { beforeAll, describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";
import {
  TEST_USER_ID,
  TEST_USER_USERNAME,
  TEST_TENANT_ID,
  MANAGER_USER_ID,
} from "./mocks/db.js";
import { buildAuthHeader } from "./utils/auth.js";

const VALID_PASSWORD = "Password123!";

describe("Authentication Routes", () => {
  let app: FastifyInstance;
  let accessToken: string;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        username: TEST_USER_USERNAME,
        password: VALID_PASSWORD,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    accessToken = payload.access_token;
  });

  describe("POST /v1/auth/login", () => {
    it("returns access token for valid credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          username: TEST_USER_USERNAME,
          password: VALID_PASSWORD,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.access_token).toBeDefined();
      expect(payload.token_type).toBe("Bearer");
      expect(payload.expires_in).toBeGreaterThan(0);
      expect(payload.id).toBe(TEST_USER_ID);
      expect(payload.memberships).toBeInstanceOf(Array);
    });

    it("returns 401 for invalid credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          username: TEST_USER_USERNAME,
          password: "WrongPassword!",
        },
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe("Invalid credentials");
    });
  });

  describe("GET /v1/auth/context", () => {
    it("returns unauthenticated context without token", async () => {
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
      expect(payload.header_hint.header).toBe("Authorization");
    });

    it("returns authenticated context with valid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(true);
      expect(payload.user_id).toBe(TEST_USER_ID);
      expect(Array.isArray(payload.memberships)).toBe(true);
    });

    it("includes tenant memberships when present", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: buildAuthHeader(TEST_USER_ID),
      });

      const payload = JSON.parse(response.payload);
      if (payload.memberships.length > 0) {
        const membership = payload.memberships[0];
        expect(membership).toHaveProperty("tenant_id");
        expect(membership).toHaveProperty("role");
        expect(membership).toHaveProperty("is_active");
        expect(membership).toHaveProperty("permissions");
      }
    });

    it("handles tokens for users without memberships", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: buildAuthHeader(MANAGER_USER_ID),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(true);
      expect(payload.user_id).toBe(MANAGER_USER_ID);
      expect(Array.isArray(payload.memberships)).toBe(true);
    });

    it("returns empty authorized_tenants before guards run", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: buildAuthHeader(TEST_USER_ID),
      });

      const payload = JSON.parse(response.payload);
      expect(payload.authorized_tenants).toEqual([]);
    });

    it("includes header hint for bearer authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
      });

      const payload = JSON.parse(response.payload);
      expect(payload.header_hint.header).toBe("Authorization");
      expect(payload.header_hint.description).toContain("Bearer");
    });

    it("treats invalid bearer tokens as unauthenticated", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/auth/context",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.is_authenticated).toBe(false);
    });
  });

  describe("Tenant authorization guard", () => {
    it("rejects requests without valid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe("You must be logged in to access this resource.");
    });

    it("allows access with valid tenant scope", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=10",
        headers: buildAuthHeader(TEST_USER_ID),
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(Array.isArray(payload)).toBe(true);
    });

    it("forbids access when role is insufficient", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/v1/dashboard/stats?tenant_id=${TEST_TENANT_ID}`,
        headers: buildAuthHeader(MANAGER_USER_ID),
      });

      expect(response.statusCode).toBe(403);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe(
        "You don't have permission to access this resource. Admin role is required.",
      );
    });
  });
});
