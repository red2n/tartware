import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";
import {
  getMockModuleRequest,
  getMockTenantModules,
  MANAGER_USER_ID,
  OTHER_TENANT_ID,
  resetMockData,
  seedModuleRequest,
  setMockTenantModules,
  STAFF_USER_ID,
  TEST_TENANT_ID,
  TEST_USER_ID,
} from "./mocks/db.js";
import { buildAuthHeader } from "./utils/auth.js";

/**
 * TEST_USER_ID is ADMIN on TEST_TENANT_ID; STAFF_USER_ID and MANAGER_USER_ID
 * are below the review bar. The point of these tests is the permission split:
 * anyone may ask, only ADMIN and above may decide.
 */
describe("Module Access Requests", () => {
  let app: FastifyInstance;

  const REQUESTS_URL = `/v1/tenants/${TEST_TENANT_ID}/module-requests`;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetMockData();
    setMockTenantModules(["core"]);
  });

  describe("POST /module-requests", () => {
    it("lets a non-admin raise a request for the module blocking them", async () => {
      const response = await app.inject({
        method: "POST",
        url: REQUESTS_URL,
        headers: buildAuthHeader(STAFF_USER_ID),
        payload: {
          moduleId: "analytics-bi",
          requestedScreen: "reports",
          reason: "Need the occupancy report for the owner call",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.moduleId).toBe("analytics-bi");
      // Resolved server-side so the review panel does not show a slug.
      expect(body.moduleName).toBe("Analytics & BI");
      expect(body.status).toBe("pending");
      expect(body.requestedScreen).toBe("reports");
    });

    it("does not require the module it is asking for", async () => {
      // The whole flow would be unreachable otherwise: the requester is blocked
      // by that very module.
      const response = await app.inject({
        method: "POST",
        url: REQUESTS_URL,
        headers: buildAuthHeader(STAFF_USER_ID),
        payload: { moduleId: "analytics-bi" },
      });

      expect(response.statusCode).toBe(201);
    });

    it("rejects an unknown module id", async () => {
      const response = await app.inject({
        method: "POST",
        url: REQUESTS_URL,
        headers: buildAuthHeader(STAFF_USER_ID),
        payload: { moduleId: "not-a-module" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("refuses when the module is already switched on", async () => {
      setMockTenantModules(["core", "analytics-bi"]);

      const response = await app.inject({
        method: "POST",
        url: REQUESTS_URL,
        headers: buildAuthHeader(STAFF_USER_ID),
        payload: { moduleId: "analytics-bi" },
      });

      expect(response.statusCode).toBe(409);
    });

    it("folds a second ask into the open request instead of duplicating it", async () => {
      const first = await app.inject({
        method: "POST",
        url: REQUESTS_URL,
        headers: buildAuthHeader(STAFF_USER_ID),
        payload: { moduleId: "analytics-bi", reason: "Weekly owner call" },
      });
      const second = await app.inject({
        method: "POST",
        url: REQUESTS_URL,
        headers: buildAuthHeader(MANAGER_USER_ID),
        payload: { moduleId: "analytics-bi" },
      });

      expect(second.statusCode).toBe(201);
      expect(second.json().id).toBe(first.json().id);
      // The first requester's justification survives the merge.
      expect(second.json().reason).toBe("Weekly owner call");
    });

    it("requires a membership on the tenant", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/v1/tenants/${OTHER_TENANT_ID}/module-requests`,
        headers: buildAuthHeader(STAFF_USER_ID),
        payload: { moduleId: "analytics-bi" },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /module-requests", () => {
    it("gives the queue to an admin", async () => {
      seedModuleRequest({ id: "11111111-1111-4111-8111-111111111111" });

      const response = await app.inject({
        method: "GET",
        url: REQUESTS_URL,
        headers: buildAuthHeader(TEST_USER_ID),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().requests).toHaveLength(1);
      expect(response.json().requests[0].moduleName).toBe("Analytics & BI");
    });

    it("keeps the queue away from non-admins", async () => {
      const response = await app.inject({
        method: "GET",
        url: REQUESTS_URL,
        headers: buildAuthHeader(STAFF_USER_ID),
      });

      expect(response.statusCode).toBe(403);
    });

    it("lets anyone see the requests they raised themselves", async () => {
      seedModuleRequest({
        id: "22222222-2222-4222-8222-222222222222",
        requested_by: STAFF_USER_ID,
      });

      const response = await app.inject({
        method: "GET",
        url: `${REQUESTS_URL}/mine`,
        headers: buildAuthHeader(STAFF_USER_ID),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().requests).toHaveLength(1);
    });
  });

  describe("POST /module-requests/:id/approve", () => {
    const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

    it("switches the module on as part of approving", async () => {
      seedModuleRequest({ id: REQUEST_ID, module_id: "analytics-bi" });

      const response = await app.inject({
        method: "POST",
        url: `${REQUESTS_URL}/${REQUEST_ID}/approve`,
        headers: buildAuthHeader(TEST_USER_ID),
        payload: { notes: "Approved for the owner call" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().request.status).toBe("approved");
      // The point of the flow: the requester's screen works straight away.
      expect(getMockTenantModules()).toContain("analytics-bi");
    });

    it("records who decided it and when", async () => {
      seedModuleRequest({ id: REQUEST_ID });

      await app.inject({
        method: "POST",
        url: `${REQUESTS_URL}/${REQUEST_ID}/approve`,
        headers: buildAuthHeader(TEST_USER_ID),
      });

      const stored = getMockModuleRequest(REQUEST_ID);
      expect(stored?.reviewed_by).toBe(TEST_USER_ID);
      expect(stored?.reviewed_at).toBeInstanceOf(Date);
    });

    it("refuses a non-admin", async () => {
      seedModuleRequest({ id: REQUEST_ID });

      const response = await app.inject({
        method: "POST",
        url: `${REQUESTS_URL}/${REQUEST_ID}/approve`,
        headers: buildAuthHeader(MANAGER_USER_ID),
      });

      expect(response.statusCode).toBe(403);
      expect(getMockTenantModules()).not.toContain("analytics-bi");
    });

    it("conflicts on a request that was already decided", async () => {
      seedModuleRequest({ id: REQUEST_ID });

      const first = await app.inject({
        method: "POST",
        url: `${REQUESTS_URL}/${REQUEST_ID}/approve`,
        headers: buildAuthHeader(TEST_USER_ID),
      });
      const second = await app.inject({
        method: "POST",
        url: `${REQUESTS_URL}/${REQUEST_ID}/approve`,
        headers: buildAuthHeader(TEST_USER_ID),
      });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(409);
    });

    it("will not decide another tenant's request", async () => {
      seedModuleRequest({ id: REQUEST_ID, tenant_id: OTHER_TENANT_ID });

      const response = await app.inject({
        method: "POST",
        url: `${REQUESTS_URL}/${REQUEST_ID}/approve`,
        headers: buildAuthHeader(TEST_USER_ID),
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe("POST /module-requests/:id/reject", () => {
    const REQUEST_ID = "44444444-4444-4444-8444-444444444444";

    it("closes the request and leaves the module switched off", async () => {
      seedModuleRequest({ id: REQUEST_ID, module_id: "analytics-bi" });

      const response = await app.inject({
        method: "POST",
        url: `${REQUESTS_URL}/${REQUEST_ID}/reject`,
        headers: buildAuthHeader(TEST_USER_ID),
        payload: { notes: "Not budgeted this quarter" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().request.status).toBe("rejected");
      expect(response.json().request.reviewNotes).toBe("Not budgeted this quarter");
      expect(getMockTenantModules()).not.toContain("analytics-bi");
    });
  });
});
