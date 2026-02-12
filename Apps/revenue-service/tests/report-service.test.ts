import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(),
}));

import {
  getRevenueKpis,
  listRevenueForecasts,
  listRevenueGoals,
} from "../src/services/report-service.js";
import { query } from "../src/lib/db.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";

const emptyResult = { rows: [], rowCount: 0, command: "SELECT" as const, oid: 0, fields: [] };

describe("report-service", () => {
  describe("getRevenueKpis", () => {
    it("computes KPIs from raw row data", async () => {
      vi.mocked(query).mockResolvedValueOnce({
        ...emptyResult,
        rows: [
          {
            occupied_rooms: "80",
            total_rooms: "100",
            room_revenue: "16000.00",
            total_revenue: "20000.00",
          },
        ],
        rowCount: 1,
      });

      const kpis = await getRevenueKpis(PROPERTY_ID, TENANT_ID, "2026-02-12");

      expect(kpis).toMatchObject({
        property_id: PROPERTY_ID,
        business_date: "2026-02-12",
        occupied_rooms: 80,
        total_rooms: 100,
        occupancy_percent: 80,
        room_revenue: 16000,
        total_revenue: 20000,
        adr: 200,
        revpar: 160,
      });
    });

    it("returns zeros when no data", async () => {
      vi.mocked(query).mockResolvedValueOnce(emptyResult);

      const kpis = await getRevenueKpis(PROPERTY_ID, TENANT_ID, "2026-02-12");

      expect(kpis.occupied_rooms).toBe(0);
      expect(kpis.total_rooms).toBe(0);
      expect(kpis.occupancy_percent).toBe(0);
      expect(kpis.adr).toBe(0);
      expect(kpis.revpar).toBe(0);
    });

    it("handles zero rooms without division errors", async () => {
      vi.mocked(query).mockResolvedValueOnce({
        ...emptyResult,
        rows: [
          {
            occupied_rooms: "0",
            total_rooms: "0",
            room_revenue: "0",
            total_revenue: "0",
          },
        ],
        rowCount: 1,
      });

      const kpis = await getRevenueKpis(PROPERTY_ID, TENANT_ID, "2026-02-12");

      expect(kpis.occupancy_percent).toBe(0);
      expect(kpis.adr).toBe(0);
      expect(kpis.revpar).toBe(0);
      expect(Number.isFinite(kpis.adr)).toBe(true);
    });
  });

  describe("listRevenueForecasts", () => {
    it("returns mapped forecast data", async () => {
      vi.mocked(query).mockResolvedValueOnce({
        ...emptyResult,
        rows: [
          {
            forecast_id: "fc-001",
            tenant_id: TENANT_ID,
            property_id: PROPERTY_ID,
            property_name: "City Center Hotel",
            forecast_date: "2026-03-01",
            forecast_period: "MONTHLY",
            room_revenue_forecast: "450000.00",
            total_revenue_forecast: "600000.00",
            occupancy_forecast: "85.5",
            adr_forecast: "220.00",
            revpar_forecast: "187.00",
            confidence_level: "0.82",
            scenario_type: "BASE",
            created_at: "2026-02-01T00:00:00Z",
            updated_at: null,
          },
        ],
        rowCount: 1,
      });

      const results = await listRevenueForecasts({ tenantId: TENANT_ID });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        forecast_period: "MONTHLY",
        room_revenue_forecast: 450000,
        occupancy_forecast: 85.5,
        adr_forecast: 220,
        scenario_type: "BASE",
      });
    });
  });

  describe("listRevenueGoals", () => {
    it("returns mapped goal data with variance", async () => {
      vi.mocked(query).mockResolvedValueOnce({
        ...emptyResult,
        rows: [
          {
            goal_id: "goal-001",
            tenant_id: TENANT_ID,
            property_id: PROPERTY_ID,
            property_name: "City Center Hotel",
            goal_name: "Q1 Room Revenue",
            goal_type: "ROOM_REVENUE",
            period_start: "2026-01-01",
            period_end: "2026-03-31",
            target_amount: "500000.00",
            actual_amount: "420000.00",
            variance_amount: "-80000.00",
            variance_percent: "-16.00",
            status: "IN_PROGRESS",
            created_at: "2025-12-15T00:00:00Z",
            updated_at: "2026-02-01T00:00:00Z",
          },
        ],
        rowCount: 1,
      });

      const results = await listRevenueGoals({ tenantId: TENANT_ID });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        goal_name: "Q1 Room Revenue",
        target_amount: 500000,
        actual_amount: 420000,
        variance_amount: -80000,
        variance_percent: -16,
        status: "IN_PROGRESS",
      });
    });
  });
});
