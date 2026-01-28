import { describe, expect, it, vi } from "vitest";

import { getPerformanceReport } from "../src/services/report-service.js";
import { query } from "../src/lib/db.js";

describe("Report Service", () => {
  it("builds a performance report from query results", async () => {
    vi.mocked(query)
      .mockImplementationOnce(async () => ({
        rows: [
          { status: "confirmed", count: "3" },
          { status: "checked_in", count: 2 },
          { status: "UNKNOWN", count: 5 },
        ],
        rowCount: 3,
        command: "SELECT",
        oid: 0,
        fields: [],
      }))
      .mockImplementationOnce(async () => ({
        rows: [
          {
            revenue_today: "250.50",
            revenue_month: 1200,
            revenue_year: null,
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      }))
      .mockImplementationOnce(async () => ({
        rows: [
          { source: "web_direct", reservations: "4", total_amount: "520.00" },
          { source: null, reservations: 1, total_amount: 50 },
        ],
        rowCount: 2,
        command: "SELECT",
        oid: 0,
        fields: [],
      }));

    const report = await getPerformanceReport({
      tenantId: "660e8400-e29b-41d4-a716-446655440000",
    });

    expect(report.statusSummary.confirmed).toBe(3);
    expect(report.statusSummary.checked_in).toBe(2);
    expect(report.statusSummary.cancelled).toBe(0);
    expect(report.revenueSummary.today).toBe(250.5);
    expect(report.revenueSummary.monthToDate).toBe(1200);
    expect(report.revenueSummary.yearToDate).toBe(0);
    expect(report.topSources).toEqual([
      { source: "Web Direct", reservations: 4, total_amount: 520 },
      { source: "unknown", reservations: 1, total_amount: 50 },
    ]);
  });

  it("returns zeroed summaries when queries are empty", async () => {
    vi.mocked(query)
      .mockImplementationOnce(async () => ({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      }))
      .mockImplementationOnce(async () => ({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      }))
      .mockImplementationOnce(async () => ({
        rows: [],
        rowCount: 0,
        command: "SELECT",
        oid: 0,
        fields: [],
      }));

    const report = await getPerformanceReport({
      tenantId: "660e8400-e29b-41d4-a716-446655440000",
      propertyId: "880e8400-e29b-41d4-a716-446655440000",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    });

    expect(report.statusSummary).toEqual({
      confirmed: 0,
      pending: 0,
      checked_in: 0,
      checked_out: 0,
      cancelled: 0,
      no_show: 0,
    });
    expect(report.revenueSummary).toEqual({
      today: 0,
      monthToDate: 0,
      yearToDate: 0,
      currency: "USD",
    });
    expect(report.topSources).toEqual([]);
  });

  it("handles non-string status and source values safely", async () => {
    vi.mocked(query)
      .mockImplementationOnce(async () => ({
        rows: [
          { status: 123, count: 1 },
          { status: null, count: 2 },
        ],
        rowCount: 2,
        command: "SELECT",
        oid: 0,
        fields: [],
      }))
      .mockImplementationOnce(async () => ({
        rows: [
          {
            revenue_today: 0,
            revenue_month: 0,
            revenue_year: 0,
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      }))
      .mockImplementationOnce(async () => ({
        rows: [
          { source: 42, reservations: 1, total_amount: 10 },
          { source: null, reservations: 2, total_amount: 20 },
        ],
        rowCount: 2,
        command: "SELECT",
        oid: 0,
        fields: [],
      }));

    const report = await getPerformanceReport({
      tenantId: "660e8400-e29b-41d4-a716-446655440000",
    });

    expect(report.statusSummary).toEqual({
      confirmed: 0,
      pending: 0,
      checked_in: 0,
      checked_out: 0,
      cancelled: 0,
      no_show: 0,
    });
    expect(report.topSources).toEqual([
      { source: "unknown", reservations: 1, total_amount: 10 },
      { source: "unknown", reservations: 2, total_amount: 20 },
    ]);
  });
});
