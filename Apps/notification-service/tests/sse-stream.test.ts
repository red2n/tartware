import http from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(async (sql: string, _params?: unknown[]) => {
    // Membership query — return a STAFF membership for the test tenant
    if (typeof sql === "string" && sql.includes("user_tenant_associations")) {
      return {
        rows: [
          {
            tenant_id: TENANT_ID,
            tenant_name: "Test Tenant",
            role: "STAFF",
            is_active: true,
            permissions: {},
            modules: ["core"],
          },
        ],
      };
    }
    // Unread count query — match the service's actual SQL pattern
    if (typeof sql === "string" && sql.includes("is_read")) {
      return { rows: [{ count: "3" }] };
    }
    // Fallback
    return { rows: [] };
  }),
  pool: { end: vi.fn() },
}));

import { buildServer } from "../src/server.js";
import { sseManager } from "../src/services/sse-manager.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "33333333-3333-3333-3333-333333333333";
const JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "test-secret-change-me-32-characters-minimum";

function signTestToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    { sub: USER_ID, username: "test.staff", type: "access", ...overrides },
    JWT_SECRET,
    { expiresIn: "5m", issuer: "tartware-core", audience: "tartware" },
  );
}

/**
 * Open a real HTTP connection to the SSE endpoint and collect the first
 * chunk of data (initial unread_count event).  Returns headers + body.
 * The connection is destroyed after the first data chunk to avoid hanging.
 */
function sseRequest(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      `http://127.0.0.1:${port}${path}`,
      { headers: { accept: "text/event-stream", ...headers } },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk.toString();
          // We have the initial event — tear down
          req.destroy();
          resolve({ statusCode: res.statusCode!, headers: res.headers, body });
        });
        // For non-SSE responses (401, etc.) that end normally
        res.on("end", () => {
          resolve({ statusCode: res.statusCode!, headers: res.headers, body });
        });
      },
    );
    req.on("error", (err) => {
      // ECONNRESET is expected when we destroy after first chunk
      if ((err as NodeJS.ErrnoException).code === "ECONNRESET") return;
      reject(err);
    });
    // Safety timeout — don't hang the test suite
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("SSE request timed out waiting for data"));
    });
  });
}

describe("SSE stream route", () => {
  let app: ReturnType<typeof buildServer>;
  let port: number;

  beforeAll(async () => {
    app = buildServer();
    // Listen on a random port for real HTTP connections
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    port = Number(new URL(address).port);
  });

  afterAll(async () => {
    sseManager.shutdown();
    await app.close();
  });

  // ─── SSE subscription via Authorization header ────────────

  it("returns 200 with SSE headers and initial unread_count", async () => {
    const token = signTestToken();

    const { statusCode, headers, body } = await sseRequest(
      port,
      `/v1/tenants/${TENANT_ID}/in-app-notifications/stream`,
      { authorization: `Bearer ${token}` },
    );

    expect(statusCode).toBe(200);
    expect(headers["content-type"]).toBe("text/event-stream");
    expect(headers["cache-control"]).toBe("no-cache");
    expect(headers.connection).toBe("keep-alive");
    expect(headers["x-accel-buffering"]).toBe("no");

    // Should contain the initial unread_count event
    expect(body).toContain("event: unread_count");
    expect(body).toContain('"unread"');
  });

  // ─── SSE token promotion from query param ─────────────────

  it("accepts ?token= query param (EventSource compatibility)", async () => {
    const token = signTestToken();

    const { statusCode, headers } = await sseRequest(
      port,
      `/v1/tenants/${TENANT_ID}/in-app-notifications/stream?token=${token}`,
    );

    expect(statusCode).toBe(200);
    expect(headers["content-type"]).toBe("text/event-stream");
  });

  // ─── Auth enforcement ─────────────────────────────────────

  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/tenants/${TENANT_ID}/in-app-notifications/stream`,
      headers: { accept: "text/event-stream" },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(401);
  });

  it("rejects expired tokens", async () => {
    const token = jwt.sign(
      { sub: USER_ID, username: "test.staff", type: "access" },
      JWT_SECRET,
      { expiresIn: "-1s", issuer: "tartware-core", audience: "tartware" },
    );

    const response = await app.inject({
      method: "GET",
      url: `/v1/tenants/${TENANT_ID}/in-app-notifications/stream`,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "text/event-stream",
      },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(401);
  });

  // ─── SSE manager integration ──────────────────────────────

  it("registers client and removes on disconnect", async () => {
    const token = signTestToken();

    // This connects, gets first chunk, then destroys the connection
    await sseRequest(
      port,
      `/v1/tenants/${TENANT_ID}/in-app-notifications/stream`,
      { authorization: `Bearer ${token}` },
    );

    // Give the server a tick to process the 'close' event
    await new Promise((r) => setTimeout(r, 100));

    // All clients from this test (and any prior) should be cleaned up
    expect(sseManager.connectionCount).toBe(0);
  });
});
