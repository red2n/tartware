import { describe, it, expect, beforeAll } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";

describe("Health Endpoint", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  describe("GET /health", () => {
    it("should return 200 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("application/json");
    });

    it("should return health status object", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty("status");
      expect(payload.status).toBe("ok");
    });

    it("should work with any headers present", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: {
          "x-user-id": "invalid-uuid",
          "x-tenant-id": "some-tenant",
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it("should respond quickly", async () => {
      const start = Date.now();
      await app.inject({
        method: "GET",
        url: "/health",
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
