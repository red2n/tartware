import { authenticator } from "otplib";
import type { FastifyInstance } from "fastify";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { buildServer } from "../src/server.js";
import {
  TEST_SYSTEM_ADMIN_PASSWORD,
  TEST_SYSTEM_ADMIN_USERNAME,
  configureSystemAdminMock,
} from "./mocks/db.js";

const buildApp = async (): Promise<FastifyInstance> => {
  const app = buildServer();
  await app.ready();
  return app;
};

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

  it("requires password rotation when the policy window is exceeded", async () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    configureSystemAdminMock({ passwordRotatedAt: ninetyDaysAgo });

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
    expect(payload.error).toBe("PASSWORD_ROTATION_REQUIRED");
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
});
