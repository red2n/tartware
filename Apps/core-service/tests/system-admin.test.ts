import { randomUUID } from "node:crypto";
import { authenticator } from "otplib";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { buildServer } from "../src/server.js";
import {
  TEST_SYSTEM_ADMIN_PASSWORD,
  TEST_SYSTEM_ADMIN_USERNAME,
  TEST_TENANT_ID,
  configureSystemAdminMock,
  seedBreakGlassCode,
} from "./mocks/db.js";
import * as systemAdminRateLimiter from "../src/lib/system-admin-rate-limiter.js";

const buildApp = async (): Promise<FastifyInstance> => {
  const app = buildServer();
  await app.ready();
  return app;
};

afterEach(() => {
  vi.restoreAllMocks();
});

const performSystemLogin = async (
  app: FastifyInstance,
  overrides: Partial<{
    username: string;
    password: string;
    mfa_code: string;
    device_fingerprint: string;
  }> = {},
) => {
  vi.spyOn(authenticator, "check").mockReturnValue(true);
  const response = await app.inject({
    method: "POST",
    url: "/v1/system/auth/login",
    payload: {
      username: TEST_SYSTEM_ADMIN_USERNAME,
      password: TEST_SYSTEM_ADMIN_PASSWORD,
      mfa_code: "123456",
      device_fingerprint: "trusted-device",
      ...overrides,
    },
  });

  expect(response.statusCode).toBe(200);
  const payload = response.json();
  expect(payload).toHaveProperty("access_token");
  expect(payload).toHaveProperty("session_id");

  return payload as {
    access_token: string;
    session_id: string;
    scope: string;
  };
};

const performBreakGlassLogin = async (
  app: FastifyInstance,
  overrides: Partial<{
    username: string;
    break_glass_code: string;
    reason: string;
    ticket_id: string;
    device_fingerprint: string;
  }> = {},
) => {
  const response = await app.inject({
    method: "POST",
    url: "/v1/system/auth/break-glass",
    payload: {
      username: TEST_SYSTEM_ADMIN_USERNAME,
      break_glass_code: "SAFE-CODE-0001",
      reason: "Primary MFA infrastructure down",
      ticket_id: "SEC-2025-0002",
      device_fingerprint: "vault-device",
      ...overrides,
    },
  });

  expect(response.statusCode).toBe(200);
  const payload = response.json();
  expect(payload).toHaveProperty("access_token");
  expect(payload).toHaveProperty("session_id");

  return payload as {
    access_token: string;
    session_id: string;
    scope: string;
  };
};

describe("System Administrator Capabilities", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("authenticates a system admin with MFA and device binding", async () => {
    const payload = await performSystemLogin(app);
    expect(payload.access_token).toMatch(/^eyJ/);
    expect(payload.scope).toBe("SYSTEM_ADMIN");
  });

  it("rejects login when MFA code is missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/system/auth/login",
      payload: {
        username: TEST_SYSTEM_ADMIN_USERNAME,
        password: TEST_SYSTEM_ADMIN_PASSWORD,
        device_fingerprint: "trusted-device",
      },
    });

    expect(response.statusCode).toBe(401);
    const payload = response.json();
    expect(payload.error).toBe("MFA_REQUIRED");
  });

  it("enforces IP whitelist restrictions", async () => {
    configureSystemAdminMock({ ipWhitelist: ["10.0.0.1/32"] });

    const response = await app.inject({
      method: "POST",
      url: "/v1/system/auth/login",
      payload: {
        username: TEST_SYSTEM_ADMIN_USERNAME,
        password: TEST_SYSTEM_ADMIN_PASSWORD,
        mfa_code: "123456",
        device_fingerprint: "trusted-device",
      },
    });

    expect(response.statusCode).toBe(403);
    const payload = response.json();
    expect(payload.error).toBe("IP_NOT_ALLOWED");
  });

  it("enforces device binding rules", async () => {
    configureSystemAdminMock({ trustedDevices: ["trusted-device"] });

    const response = await app.inject({
      method: "POST",
      url: "/v1/system/auth/login",
      payload: {
        username: TEST_SYSTEM_ADMIN_USERNAME,
        password: TEST_SYSTEM_ADMIN_PASSWORD,
        mfa_code: "123456",
        device_fingerprint: "untrusted-device",
      },
    });

    expect(response.statusCode).toBe(403);
    const payload = response.json();
    expect(payload.error).toBe("DEVICE_NOT_TRUSTED");
  });

  it("allows authorized system admins to list users across tenants", async () => {
    const { access_token } = await performSystemLogin(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/system/users?limit=5",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBeGreaterThan(0);
  });

  it("allows system admins to create users with tenant assignments", async () => {
    const { access_token } = await performSystemLogin(app);
    const unique = randomUUID().slice(0, 8);

    const response = await app.inject({
      method: "POST",
      url: "/v1/system/users",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      payload: {
        username: `system-user-${unique}`,
        email: `system-user-${unique}@example.com`,
        password: "TempPass123!",
        first_name: "System",
        last_name: "User",
        tenant_id: TEST_TENANT_ID,
        role: "MANAGER",
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json();
    expect(payload.username).toBe(`system-user-${unique}`);
    expect(payload).toHaveProperty("id");
  });

  it("rejects system routes without admin token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/system/users",
    });

    expect(response.statusCode).toBe(401);
  });

  it("allows system admins to list tenants across the platform", async () => {
    const { access_token } = await performSystemLogin(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/system/tenants?limit=5",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload).toHaveProperty("tenants");
    expect(Array.isArray(payload.tenants)).toBe(true);
  });

  it("allows system admins to create tenants", async () => {
    const { access_token } = await performSystemLogin(app);
    const unique = randomUUID().slice(0, 8);

    const response = await app.inject({
      method: "POST",
      url: "/v1/system/tenants",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      payload: {
        name: `System Tenant ${unique}`,
        slug: `system-tenant-${unique}`,
        type: "INDEPENDENT",
        email: `tenant-${unique}@example.com`,
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json();
    expect(payload).toHaveProperty("id");
    expect(payload.slug).toBe(`system-tenant-${unique}`);
  });

  it("allows system admins to bootstrap tenants", async () => {
    const { access_token } = await performSystemLogin(app);
    const unique = randomUUID().slice(0, 8);

    const response = await app.inject({
      method: "POST",
      url: "/v1/system/tenants/bootstrap",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      payload: {
        tenant: {
          name: `Bootstrap Tenant ${unique}`,
          slug: `bootstrap-${unique}`,
          type: "INDEPENDENT",
          email: `bootstrap-${unique}@example.com`,
        },
        property: {
          property_name: "Main Property",
          property_code: `PROP${unique.toUpperCase()}`,
        },
        owner: {
          username: `owner_${unique}`,
          email: `owner-${unique}@example.com`,
          password: "TempPass123!",
          first_name: "Owner",
          last_name: "User",
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json();
    expect(payload).toHaveProperty("tenant.id");
    expect(payload).toHaveProperty("property.id");
    expect(payload).toHaveProperty("owner.id");
  });

  it("issues short-lived tenant tokens through impersonation", async () => {
    const { access_token } = await performSystemLogin(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/system/impersonate",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      payload: {
        tenant_id: "660e8400-e29b-41d4-a716-446655440000",
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        reason: "Investigating customer-reported issue",
        ticket_id: "SEC-2025-0001",
      },
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.scope).toBe("TENANT_IMPERSONATION");
    expect(payload.access_token).toMatch(/^eyJ/);
  });

  it("enforces per-admin rate limiting with a 200 request burst cap", async () => {
    const { access_token } = await performSystemLogin(app);
    let allowance = 200;
    vi.spyOn(systemAdminRateLimiter, "consumeSystemAdminRateLimit").mockImplementation(
      async () => {
        if (allowance > 0) {
          allowance -= 1;
          return { allowed: true, remaining: allowance };
        }
        return { allowed: false, remaining: 0, retryAfterMs: 1_000 };
      },
    );

    for (let i = 0; i < 200; i += 1) {
      const response = await app.inject({
        method: "GET",
        url: "/v1/system/users?limit=1",
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      expect(response.statusCode).toBe(200);
    }

    const limitedResponse = await app.inject({
      method: "GET",
      url: "/v1/system/users?limit=1",
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    expect(limitedResponse.statusCode).toBe(429);
    const payload = limitedResponse.json();
    expect(payload.error).toBe("SYSTEM_ADMIN_RATE_LIMITED");
  });

  it("allows break-glass authentication when a valid unused code is provided", async () => {
    seedBreakGlassCode("SAFE-CODE-0001");
    const payload = await performBreakGlassLogin(app);
    expect(payload.scope).toBe("SYSTEM_ADMIN");

    // Same code cannot be replayed after first use
    const replayResponse = await app.inject({
      method: "POST",
      url: "/v1/system/auth/break-glass",
      payload: {
        username: TEST_SYSTEM_ADMIN_USERNAME,
        break_glass_code: "SAFE-CODE-0001",
        reason: "Retry after success should fail",
        ticket_id: "SEC-2025-0003",
        device_fingerprint: "vault-device",
      },
    });

    expect(replayResponse.statusCode).toBe(403);
    const replayPayload = replayResponse.json();
    expect(replayPayload.error).toBe("BREAK_GLASS_UNAVAILABLE");
  });

  it("rejects break-glass authentication when the code is incorrect", async () => {
    seedBreakGlassCode("SAFE-CODE-9999");

    const response = await app.inject({
      method: "POST",
      url: "/v1/system/auth/break-glass",
      payload: {
        username: TEST_SYSTEM_ADMIN_USERNAME,
        break_glass_code: "WRONG-CODE-0000",
        reason: "Operator typed an incorrect vault code",
        ticket_id: "SEC-2025-0004",
        device_fingerprint: "vault-device",
      },
    });

    expect(response.statusCode).toBe(401);
    const payload = response.json();
    expect(payload.error).toBe("BREAK_GLASS_CODE_INVALID");
  });

  it("rejects break-glass authentication when no active codes are available", async () => {
    seedBreakGlassCode("EXPIRED-CODE-0001", {
      expiresAt: new Date(Date.now() - 60_000),
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/system/auth/break-glass",
      payload: {
        username: TEST_SYSTEM_ADMIN_USERNAME,
        break_glass_code: "EXPIRED-CODE-0001",
        reason: "Attempt against expired code should fail",
        ticket_id: "SEC-2025-0005",
        device_fingerprint: "vault-device",
      },
    });

    expect(response.statusCode).toBe(403);
    const payload = response.json();
    expect(payload.error).toBe("BREAK_GLASS_UNAVAILABLE");
  });
});
