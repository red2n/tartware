import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildServer } from "../src/server.js";
import {
  TEST_TENANT_ID,
  TEST_USER_ID,
  VIEWER_USER_ID,
} from "./mocks/db.js";
import { buildAuthHeader } from "./utils/auth.js";

describe("Module Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /v1/modules/catalog", () => {
    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/modules/catalog",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return module catalog for authenticated user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/modules/catalog",
        headers: buildAuthHeader(TEST_USER_ID),
      });

      expect(response.statusCode).toBe(200);
      const modules = response.json();
      expect(Array.isArray(modules)).toBe(true);
      expect(modules.length).toBeGreaterThan(0);
      expect(modules[0]).toHaveProperty("id");
      expect(modules[0]).toHaveProperty("name");
      expect(modules[0]).toHaveProperty("tier");
    });
  });

  describe("GET /v1/tenants/:tenantId/modules", () => {
    it("should return enabled modules for admin user", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/v1/tenants/${TEST_TENANT_ID}/modules`,
        headers: buildAuthHeader(TEST_USER_ID),
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toMatchObject({
        tenantId: TEST_TENANT_ID,
      });
      expect(Array.isArray(payload.modules)).toBe(true);
      expect(payload.modules).toContain("core");
    });

    it("should forbid access for viewer role", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/v1/tenants/${TEST_TENANT_ID}/modules`,
        headers: buildAuthHeader(VIEWER_USER_ID),
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
