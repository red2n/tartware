import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import * as db from "../src/lib/db.js";
import { logSystemAdminEvent } from "../src/services/system-admin-service.js";
import {
  TEST_SYSTEM_ADMIN_ID,
  TEST_TENANT_ID,
  TEST_USER_ID,
} from "./mocks/db.js";

describe("System Admin Audit Logging", () => {
  it("redacts sensitive payload fields and stores hashed identifiers", async () => {
    const queryMock = vi.mocked(db.query);

    await logSystemAdminEvent({
      adminId: TEST_SYSTEM_ADMIN_ID,
      action: "TEST_ACTION",
      resourceType: "USER",
      resourceId: TEST_USER_ID,
      tenantId: TEST_TENANT_ID,
      requestMethod: "POST",
      requestPath: "/v1/system/users",
      requestPayload: {
        email: "sensitive@example.com",
        passportNumber: "P123456",
        payment: {
          card_number: "4111111111111111",
          cvv: "123",
        },
      },
      responseStatus: 200,
      ipAddress: "203.0.113.5",
      userAgent: "vitest",
      sessionId: "session-abc",
    });

    expect(queryMock).toHaveBeenCalled();

    const [, params] = queryMock.mock.calls.at(-1)!;
    const payload = params?.[7] as Record<string, any>;

    expect(payload.email).toBe("[REDACTED]");
    expect(payload.passportNumber).toBe("[REDACTED]");
    expect(payload.payment.card_number).toBe("[REDACTED]");
    expect(payload.payment.cvv).toBe("[REDACTED]");

    const hashed = payload.hashed_identifiers;
    expect(hashed).toBeDefined();
    expect(hashed.resource_id).toBe(createHash("sha256").update(TEST_USER_ID).digest("hex"));
    expect(hashed.tenant_id).toBe(createHash("sha256").update(TEST_TENANT_ID).digest("hex"));
    expect(hashed.session_id).toBe(createHash("sha256").update("session-abc").digest("hex"));
    expect(hashed.ip_address).toBe(createHash("sha256").update("203.0.113.5").digest("hex"));
  });
});
