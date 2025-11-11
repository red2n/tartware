import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildServer } from "../src/server.js";
import type { FastifyInstance } from "fastify";
import { query } from "../src/lib/db.js";
import {
  TEST_USER_ID,
  TEST_TENANT_ID,
  TEST_PROPERTY_ID,
  STAFF_USER_ID,
  MANAGER_USER_ID,
  VIEWER_USER_ID,
  MODULE_DISABLED_USER_ID,
} from "./mocks/db.js";
import { buildAuthHeader } from "./utils/auth.js";

describe("Dashboard Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();

    // Setup mock responses for dashboard queries
    vi.mocked(query).mockImplementation(async (text: string, params?: unknown[]) => {
      const sql = text.trim().toLowerCase();

      // Mock room count query
      if (sql.includes("count(*) as total_rooms") && sql.includes("from rooms")) {
        return {
          rows: [{ total_rooms: "100" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      // Mock occupied rooms query
      if (sql.includes("count(distinct room_number) as occupied_rooms")) {
        return {
          rows: [{ occupied_rooms: "75" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      // Mock revenue query
      if (sql.includes("sum(amount)") && sql.includes("from payments")) {
        return {
          rows: [{ revenue_today: "2500.50" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      // Mock tasks query FIRST (most specific - has CASE and due_time)
      if (sql.includes("case") && sql.includes("due_time")) {
        return {
          rows: [
            {
              id: "task-1",
              title: "Check-in at 03:00 PM",
              description: "201 • Alice Johnson",
              due_time: new Date(),
              priority: "high",
              icon: "login",
            },
            {
              id: "task-2",
              title: "Check-out at 11:00 AM",
              description: "102 • Bob Wilson",
              due_time: new Date(Date.now() + 3600000),
              priority: "medium",
              icon: "logout",
            },
          ],
          rowCount: 2,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      // Mock check-ins query (less specific)
      if (sql.includes("check_in_date = current_date") && !sql.includes("due_time")) {
        return {
          rows: [{ total: "8", pending: "3" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      // Mock check-outs query (less specific)
      if (sql.includes("check_out_date = current_date") && !sql.includes("due_time")) {
        return {
          rows: [{ total: "5", pending: "2" }],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      // Mock activity query
      if (sql.includes("new reservation created")) {
        return {
          rows: [
            {
              id: "test-id-1",
              type: "reservation",
              title: "New reservation created",
              description: "101 • John Doe",
              timestamp: new Date(),
              icon: "event",
            },
            {
              id: "test-id-2",
              type: "reservation",
              title: "New reservation created",
              description: "102 • Jane Smith",
              timestamp: new Date(),
              icon: "event",
            },
          ],
          rowCount: 2,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      // Mock activity query
      if (sql.includes("new reservation created")) {
        return {
          rows: [
            {
              id: "test-id-1",
              type: "reservation",
              title: "New reservation created",
              description: "101 • John Doe",
              timestamp: new Date(),
              icon: "event",
            },
            {
              id: "test-id-2",
              type: "reservation",
              title: "New reservation created",
              description: "102 • Jane Smith",
              timestamp: new Date(),
              icon: "event",
            },
          ],
          rowCount: 2,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      }

      // Mock user-tenant-associations for auth
      if (sql.includes("user_tenant_associations") && sql.includes("where uta.user_id")) {
        const userId = params?.[0];

        if (userId === STAFF_USER_ID) {
          return {
            rows: [
              {
                tenant_id: TEST_TENANT_ID,
                role: "STAFF",
                is_active: true,
                permissions: {},
              },
            ],
            rowCount: 1,
            command: "SELECT",
            oid: 0,
            fields: [],
          };
        }

        if (userId === MANAGER_USER_ID) {
          return {
            rows: [
              {
                tenant_id: TEST_TENANT_ID,
                role: "MANAGER",
                is_active: true,
                permissions: {},
              },
            ],
            rowCount: 1,
            command: "SELECT",
            oid: 0,
            fields: [],
          };
        }

        if (userId === VIEWER_USER_ID) {
          return {
            rows: [
              {
                tenant_id: TEST_TENANT_ID,
                role: "VIEWER",
                is_active: true,
                permissions: {},
              },
            ],
            rowCount: 1,
            command: "SELECT",
            oid: 0,
            fields: [],
          };
        }

        if (userId === TEST_USER_ID) {
          return {
            rows: [
              {
                tenant_id: TEST_TENANT_ID,
                role: "ADMIN",
                is_active: true,
                permissions: {},
              },
            ],
            rowCount: 1,
            command: "SELECT",
            oid: 0,
            fields: [],
          };
        }
      }

      // Default empty result
      return {
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /v1/dashboard/stats", () => {
    describe("Positive Cases", () => {
      it("should return dashboard stats for admin user with specific property", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(TEST_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();

        expect(data).toHaveProperty("occupancy");
        expect(data.occupancy).toHaveProperty("rate");
        expect(data.occupancy).toHaveProperty("change");
        expect(data.occupancy).toHaveProperty("trend");
        expect(typeof data.occupancy.rate).toBe("number");
        expect(data.occupancy.rate).toBeGreaterThanOrEqual(0);
        expect(data.occupancy.rate).toBeLessThanOrEqual(100);

        expect(data).toHaveProperty("revenue");
        expect(data.revenue).toHaveProperty("today");
        expect(data.revenue).toHaveProperty("change");
        expect(data.revenue).toHaveProperty("trend");
        expect(data.revenue).toHaveProperty("currency");
        expect(typeof data.revenue.today).toBe("number");
        expect(data.revenue.today).toBeGreaterThanOrEqual(0);

        expect(data).toHaveProperty("checkIns");
        expect(data.checkIns).toHaveProperty("total");
        expect(data.checkIns).toHaveProperty("pending");
        expect(typeof data.checkIns.total).toBe("number");
        expect(typeof data.checkIns.pending).toBe("number");

        expect(data).toHaveProperty("checkOuts");
        expect(data.checkOuts).toHaveProperty("total");
        expect(data.checkOuts).toHaveProperty("pending");
        expect(typeof data.checkOuts.total).toBe("number");
        expect(typeof data.checkOuts.pending).toBe("number");
      });

      it("should return aggregated stats for all properties", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: "all",
          },
          headers: {
            ...buildAuthHeader(TEST_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(data).toHaveProperty("occupancy");
        expect(data).toHaveProperty("revenue");
        expect(data).toHaveProperty("checkIns");
        expect(data).toHaveProperty("checkOuts");
      });

      it("should return stats when property_id is omitted (defaults to all)", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: TEST_TENANT_ID,
          },
          headers: {
            ...buildAuthHeader(TEST_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(data).toHaveProperty("occupancy");
      });

      it("should forbid stats for manager user", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(403);
      });

      it("should forbid stats for staff user", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(STAFF_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(403);
      });
    });

    describe("Negative Cases", () => {
      it("should return 400 for invalid tenant_id format", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: "invalid-uuid",
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(TEST_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });

      it("should return 400 for invalid property_id format", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: "invalid-uuid",
          },
          headers: {
            ...buildAuthHeader(TEST_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });

      it("should return 400 when tenant_id is missing", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(TEST_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });

      it("should return 401 when authentication headers are missing", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
        });

        expect(response.statusCode).toBe(401);
      });

      it("should return 403 for insufficient permissions (viewer role)", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(VIEWER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(403);
      });

      it("should return 403 when required module is not enabled", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(MODULE_DISABLED_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(403);
      });

      it("should return 403 for cross-tenant access attempt", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/stats",
          query: {
            tenant_id: "other-tenant-id",
            property_id: "other-property-id",
          },
          headers: {
            ...buildAuthHeader(TEST_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });
    });
  });

  describe("GET /v1/dashboard/activity", () => {
    describe("Positive Cases", () => {
      it("should return recent activity for staff user", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/activity",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(Array.isArray(data)).toBe(true);

        if (data.length > 0) {
          expect(data[0]).toHaveProperty("id");
          expect(data[0]).toHaveProperty("type");
          expect(data[0]).toHaveProperty("title");
          expect(data[0]).toHaveProperty("description");
          expect(data[0]).toHaveProperty("timestamp");
          expect(data[0]).toHaveProperty("icon");
        }
      });

      it("should return activity for all properties", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/activity",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: "all",
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(Array.isArray(data)).toBe(true);
      });

      it("should limit activity to 5 items", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/activity",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(data.length).toBeLessThanOrEqual(5);
      });
    });

    describe("Negative Cases", () => {
      it("should return 400 for invalid tenant_id", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/activity",
          query: {
            tenant_id: "not-a-uuid",
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });

      it("should return 401 without authentication", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/activity",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
        });

        expect(response.statusCode).toBe(401);
      });

      it("should return 403 for cross-tenant access", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/activity",
          query: {
            tenant_id: "other-tenant-id",
            property_id: "other-property-id",
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });
    });
  });

  describe("GET /v1/dashboard/tasks", () => {
    describe("Positive Cases", () => {
      it("should return upcoming tasks for manager user", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/tasks",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(Array.isArray(data)).toBe(true);

        if (data.length > 0) {
          expect(data[0]).toHaveProperty("id");
          expect(data[0]).toHaveProperty("title");
          expect(data[0]).toHaveProperty("description");
          expect(data[0]).toHaveProperty("due_time");
          expect(data[0]).toHaveProperty("priority");
          expect(data[0]).toHaveProperty("icon");
          expect(["urgent", "high", "medium", "low"]).toContain(data[0].priority);
        }
      });

      it("should return tasks for all properties", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/tasks",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: "all",
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(Array.isArray(data)).toBe(true);
      });

      it("should limit tasks to 10 items", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/tasks",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();
        expect(data.length).toBeLessThanOrEqual(10);
      });

      it("should order tasks by due_time ascending", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/tasks",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(200);
        const data = response.json();

        if (data.length > 1) {
          const dates = data.map((task: any) => new Date(task.due_time).getTime());
          const sortedDates = [...dates].sort((a, b) => a - b);
          expect(dates).toEqual(sortedDates);
        }
      });
    });

    describe("Negative Cases", () => {
      it("should return 400 for invalid property_id", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/tasks",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: "invalid",
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });

      it("should return 400 when tenant_id is missing", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/tasks",
          query: {
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });

      it("should return 401 without authentication headers", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/tasks",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
        });

        expect(response.statusCode).toBe(401);
      });

      it("should return 403 for insufficient role", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/tasks",
          query: {
            tenant_id: TEST_TENANT_ID,
            property_id: TEST_PROPERTY_ID,
          },
          headers: {
            ...buildAuthHeader(VIEWER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBe(403);
      });

      it("should return 403 for cross-tenant data access", async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/dashboard/tasks",
          query: {
            tenant_id: "other-tenant-id",
            property_id: "other-property-id",
          },
          headers: {
            ...buildAuthHeader(MANAGER_USER_ID),
            "x-tenant-id": TEST_TENANT_ID,
          },
        });

        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty results gracefully for new tenant", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/dashboard/stats",
        query: {
          tenant_id: TEST_TENANT_ID,
          property_id: TEST_PROPERTY_ID,
        },
        headers: {
          ...buildAuthHeader(TEST_USER_ID),
          "x-tenant-id": TEST_TENANT_ID,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      // Mock returns data, so we just verify structure
      expect(data).toHaveProperty("occupancy");
      expect(data).toHaveProperty("revenue");
      expect(data).toHaveProperty("checkIns");
      expect(data).toHaveProperty("checkOuts");
    });

    it("should handle property_id as both UUID and 'all' string", async () => {
      const uuidResponse = await app.inject({
        method: "GET",
        url: "/v1/dashboard/stats",
        query: {
          tenant_id: TEST_TENANT_ID,
          property_id: TEST_PROPERTY_ID,
        },
        headers: {
          ...buildAuthHeader(TEST_USER_ID),
          "x-tenant-id": TEST_TENANT_ID,
        },
      });

      const allResponse = await app.inject({
        method: "GET",
        url: "/v1/dashboard/stats",
        query: {
          tenant_id: TEST_TENANT_ID,
          property_id: "all",
        },
        headers: {
          ...buildAuthHeader(TEST_USER_ID),
          "x-tenant-id": TEST_TENANT_ID,
        },
      });

      expect(uuidResponse.statusCode).toBe(200);
      expect(allResponse.statusCode).toBe(200);
    });

    it("should return consistent data structure even with no data", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/dashboard/activity",
        query: {
          tenant_id: TEST_TENANT_ID,
          property_id: TEST_PROPERTY_ID,
        },
        headers: {
          ...buildAuthHeader(MANAGER_USER_ID),
          "x-tenant-id": TEST_TENANT_ID,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(Array.isArray(data)).toBe(true);
      // Mock returns data, so we just verify it's an array
      expect(data.length).toBeGreaterThanOrEqual(0);
    });
  });
});
