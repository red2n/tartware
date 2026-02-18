import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(),
}));

import {
  listHousekeepingInspections,
  listHousekeepingSchedules,
  listHousekeepingTasks,
} from "../src/services/housekeeping-service.js";
import { query } from "../src/lib/db.js";

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  tenant_id: "660e8400-e29b-41d4-a716-446655440000",
  property_id: "880e8400-e29b-41d4-a716-446655440000",
  property_name: null,
  room_number: "101",
  task_type: "CLEAN",
  priority: null,
  status: "COMPLETED",
  assigned_to: null,
  assigned_at: null,
  scheduled_date: "2024-01-01",
  scheduled_time: null,
  started_at: null,
  completed_at: null,
  inspected_by: null,
  inspected_at: null,
  inspection_passed: null,
  is_guest_request: null,
  special_instructions: null,
  notes: null,
  issues_found: null,
  metadata: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
  version: BigInt(1),
  credits: null,
  ...overrides,
});

const dbResult = (rows: Record<string, unknown>[]) => ({
  rows,
  rowCount: rows.length,
  command: "SELECT" as const,
  oid: 0,
  fields: [],
});

describe("Housekeeping Service", () => {
  it("normalizes status with non-string values", async () => {
    vi.mocked(query).mockResolvedValueOnce(dbResult([makeRow({ status: 123 })]));

    const results = await listHousekeepingTasks({
      tenantId: "660e8400-e29b-41d4-a716-446655440000",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("unknown");
    expect(results[0]?.status_display).toBe("Unknown");
  });

  describe("listHousekeepingSchedules", () => {
    it("passes parameters in correct order", async () => {
      vi.mocked(query).mockResolvedValueOnce(dbResult([makeRow({ scheduled_date: "2024-06-15" })]));

      const results = await listHousekeepingSchedules({
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
        propertyId: "880e8400-e29b-41d4-a716-446655440000",
        dateFrom: "2024-06-01",
        dateTo: "2024-06-30",
        limit: 50,
        offset: 10,
      });

      expect(results).toHaveLength(1);
      expect(vi.mocked(query)).toHaveBeenCalledWith(
        expect.any(String),
        [50, "660e8400-e29b-41d4-a716-446655440000", "880e8400-e29b-41d4-a716-446655440000", "2024-06-01", "2024-06-30", 10],
      );
    });

    it("defaults optional parameters to null", async () => {
      vi.mocked(query).mockResolvedValueOnce(dbResult([]));

      await listHousekeepingSchedules({
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
      });

      expect(vi.mocked(query)).toHaveBeenCalledWith(
        expect.any(String),
        [200, "660e8400-e29b-41d4-a716-446655440000", null, null, null, 0],
      );
    });
  });

  describe("listHousekeepingInspections", () => {
    it("passes parameters in correct order including passed filter", async () => {
      vi.mocked(query).mockResolvedValueOnce(dbResult([makeRow({ inspection_passed: true })]));

      const results = await listHousekeepingInspections({
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
        propertyId: "880e8400-e29b-41d4-a716-446655440000",
        passed: true,
        dateFrom: "2024-06-01",
        dateTo: "2024-06-30",
        limit: 25,
        offset: 5,
      });

      expect(results).toHaveLength(1);
      expect(vi.mocked(query)).toHaveBeenCalledWith(
        expect.any(String),
        [25, "660e8400-e29b-41d4-a716-446655440000", "880e8400-e29b-41d4-a716-446655440000", true, "2024-06-01", "2024-06-30", 5],
      );
    });

    it("handles passed=false correctly (not treated as null)", async () => {
      vi.mocked(query).mockResolvedValueOnce(dbResult([makeRow({ inspection_passed: false })]));

      await listHousekeepingInspections({
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
        passed: false,
      });

      expect(vi.mocked(query)).toHaveBeenCalledWith(
        expect.any(String),
        [200, "660e8400-e29b-41d4-a716-446655440000", null, false, null, null, 0],
      );
    });

    it("defaults optional parameters to null", async () => {
      vi.mocked(query).mockResolvedValueOnce(dbResult([]));

      await listHousekeepingInspections({
        tenantId: "660e8400-e29b-41d4-a716-446655440000",
      });

      expect(vi.mocked(query)).toHaveBeenCalledWith(
        expect.any(String),
        [200, "660e8400-e29b-41d4-a716-446655440000", null, null, null, null, 0],
      );
    });
  });
});
