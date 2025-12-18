import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildServer } from "../src/server.js";
import { buildAuthHeader } from "./utils/auth.js";
import {
  MANAGER_USER_ID,
  STAFF_USER_ID,
  TEST_USER_ID,
  VIEWER_USER_ID,
} from "./mocks/db.js";

describe("Tenants Endpoint", () => {
  let app: FastifyInstance;
  const adminUserId = TEST_USER_ID;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  describe("GET /v1/tenants - Access Control", () => {
    it("allows tenant ADMIN users to list their tenants", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants?limit=10",
        headers: buildAuthHeader(adminUserId),
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty("id");
        expect(body[0]).toHaveProperty("name");
        expect(body[0]).toHaveProperty("status");
      }
    });

    it("rejects unauthenticated requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
      });

      expect(response.statusCode).toBe(401);
    });

    it("rejects MANAGER role (insufficient privilege)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader(MANAGER_USER_ID),
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejects STAFF role (insufficient privilege)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader(STAFF_USER_ID),
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejects VIEWER role (insufficient privilege)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader(VIEWER_USER_ID),
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejects users with no tenant memberships", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/tenants",
        headers: buildAuthHeader("00000000-0000-0000-0000-000000000000"),
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
