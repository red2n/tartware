/**
 * The write path for per-command grants.
 *
 * The rule worth a test is the escalation one: an ADMIN who could grant a
 * command declared at OWNER could grant it to their own membership, which
 * defeats the whole ladder in a single call.
 */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildServer } from "../src/server.js";
import { OWNER_USER_ID, STAFF_USER_ID, TEST_TENANT_ID, TEST_USER_ID } from "./mocks/db.js";
import { buildAuthHeader } from "./utils/auth.js";

const URL = "/v1/user-tenant-associations/command-permissions";

const grants = (body: Record<string, unknown>, actor: string) => ({
  method: "POST" as const,
  url: URL,
  headers: buildAuthHeader(actor),
  payload: { tenant_id: TEST_TENANT_ID, user_id: STAFF_USER_ID, ...body },
});

describe("POST /v1/user-tenant-associations/command-permissions", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("refuses an ADMIN granting a command declared above them", async () => {
    // TEST_USER_ID is ADMIN; billing.fiscal_period.reopen is declared at OWNER.
    const response = await app.inject(
      grants({ allow: ["billing.fiscal_period.reopen"] }, TEST_USER_ID),
    );
    expect(response.statusCode).toBe(403);
    expect(response.body).toContain("GRANT_EXCEEDS_GRANTOR_AUTHORITY");
  });

  it("lets an OWNER grant the same command", async () => {
    const response = await app.inject(
      grants({ allow: ["billing.fiscal_period.reopen"] }, OWNER_USER_ID),
    );
    expect(response.statusCode).toBe(200);
  });

  it("lets an ADMIN deny a command they could not grant", async () => {
    // Removing a right is not an escalation, so the grantor rule does not apply.
    const response = await app.inject(
      grants({ allow: [], deny: ["billing.fiscal_period.reopen"] }, TEST_USER_ID),
    );
    expect(response.statusCode).toBe(200);
  });

  it("rejects a command name that is not declared", async () => {
    // A typo stored as a grant of nothing reads as a working one.
    const response = await app.inject(
      grants({ allow: ["billing.charge.viod"] }, TEST_USER_ID),
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("UNKNOWN_COMMAND");
  });

  it("is closed to a role below ADMIN", async () => {
    const response = await app.inject(grants({ allow: [] }, STAFF_USER_ID));
    expect(response.statusCode).toBe(403);
  });
});
