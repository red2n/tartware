import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildServer } from "../src/server.js";
import * as reservationService from "../src/services/reservation-service.js";
import * as reportService from "../src/services/report-service.js";
import * as moduleService from "../src/services/tenant-module-service.js";
import {
  MANAGER_USER_ID,
  STAFF_USER_ID,
  TEST_TENANT_ID,
  TEST_USER_ID,
} from "./mocks/db.js";
import { buildAuthHeader } from "./utils/auth.js";

const createServer = async (): Promise<FastifyInstance> => {
  const app = buildServer();
  await app.ready();
  return app;
};

describe("Route authorization policies", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createServer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires manager role for reservation listings", async () => {
    vi.spyOn(reservationService, "listReservations").mockResolvedValue([]);

    const managerResponse = await app.inject({
      method: "GET",
      url: `/v1/reservations?tenant_id=${TEST_TENANT_ID}`,
      headers: buildAuthHeader(MANAGER_USER_ID),
    });
    expect(managerResponse.statusCode).toBe(200);

    const staffResponse = await app.inject({
      method: "GET",
      url: `/v1/reservations?tenant_id=${TEST_TENANT_ID}`,
      headers: buildAuthHeader(STAFF_USER_ID),
    });
    expect(staffResponse.statusCode).toBe(403);
  });

  it("limits analytics reports to admins with the analytics module", async () => {
    vi.spyOn(reportService, "getPerformanceReport").mockResolvedValue({
      statusSummary: {
        confirmed: 10,
        pending: 2,
        checked_in: 5,
        checked_out: 4,
        cancelled: 1,
        no_show: 0,
      },
      revenueSummary: {
        today: 1200,
        monthToDate: 15000,
        yearToDate: 180000,
        currency: "USD",
      },
      topSources: [
        { source: "Direct", reservations: 8, total_amount: 8000 },
        { source: "OTA", reservations: 4, total_amount: 4000 },
      ],
    });

    const adminResponse = await app.inject({
      method: "GET",
      url: `/v1/reports/performance?tenant_id=${TEST_TENANT_ID}`,
      headers: buildAuthHeader(TEST_USER_ID),
    });
    expect(adminResponse.statusCode).toBe(200);

    const managerResponse = await app.inject({
      method: "GET",
      url: `/v1/reports/performance?tenant_id=${TEST_TENANT_ID}`,
      headers: buildAuthHeader(MANAGER_USER_ID),
    });
    expect(managerResponse.statusCode).toBe(403);
  });

  it("requires admin role to view tenant module assignments", async () => {
    vi.spyOn(moduleService, "getTenantModules").mockResolvedValue({
      tenantId: TEST_TENANT_ID,
      modules: [],
    });

    const adminResponse = await app.inject({
      method: "GET",
      url: `/v1/tenants/${TEST_TENANT_ID}/modules`,
      headers: buildAuthHeader(TEST_USER_ID),
    });
    expect(adminResponse.statusCode).toBe(200);

    const managerResponse = await app.inject({
      method: "GET",
      url: `/v1/tenants/${TEST_TENANT_ID}/modules`,
      headers: buildAuthHeader(MANAGER_USER_ID),
    });
    expect(managerResponse.statusCode).toBe(403);
  });

  it("blocks staff from dashboard activity when manager role is required", async () => {
    const staffResponse = await app.inject({
      method: "GET",
      url: `/v1/dashboard/activity?tenant_id=${TEST_TENANT_ID}`,
      headers: buildAuthHeader(STAFF_USER_ID),
    });
    expect(staffResponse.statusCode).toBe(403);
  });
});
