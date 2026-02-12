import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(),
}));

import {
  listPricingRules,
  getPricingRuleById,
  listRateRecommendations,
  listCompetitorRates,
  listDemandCalendar,
} from "../src/services/pricing-service.js";
import { query } from "../src/lib/db.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";

const makePricingRuleRow = (overrides: Record<string, unknown> = {}) => ({
  rule_id: "rule-001",
  tenant_id: TENANT_ID,
  property_id: PROPERTY_ID,
  property_name: "City Center Hotel",
  rule_name: "Weekend Surge",
  rule_type: "OCCUPANCY_BASED",
  priority: 10,
  is_active: true,
  effective_from: "2026-01-01",
  effective_to: "2026-12-31",
  applies_to_room_types: null,
  applies_to_rate_plans: null,
  condition_type: "THRESHOLD",
  condition_value: 80,
  adjustment_type: "PERCENTAGE",
  adjustment_value: "15.00",
  min_rate: "100.00",
  max_rate: "500.00",
  created_at: "2025-06-01T00:00:00Z",
  updated_at: "2025-12-01T00:00:00Z",
  ...overrides,
});

const emptyResult = { rows: [], rowCount: 0, command: "SELECT" as const, oid: 0, fields: [] };

describe("pricing-service", () => {
  describe("listPricingRules", () => {
    it("returns mapped pricing rules", async () => {
      vi.mocked(query).mockResolvedValueOnce({
        ...emptyResult,
        rows: [makePricingRuleRow()],
        rowCount: 1,
      });

      const results = await listPricingRules({ tenantId: TENANT_ID });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        rule_id: "rule-001",
        rule_name: "Weekend Surge",
        rule_type: "OCCUPANCY_BASED",
        is_active: true,
        adjustment_value: 15,
        min_rate: 100,
        max_rate: 500,
      });
    });

    it("returns empty array when no rules found", async () => {
      vi.mocked(query).mockResolvedValueOnce(emptyResult);

      const results = await listPricingRules({ tenantId: TENANT_ID });

      expect(results).toEqual([]);
    });
  });

  describe("getPricingRuleById", () => {
    it("returns mapped rule when found", async () => {
      vi.mocked(query).mockResolvedValueOnce({
        ...emptyResult,
        rows: [makePricingRuleRow()],
        rowCount: 1,
      });

      const result = await getPricingRuleById("rule-001", TENANT_ID);

      expect(result).not.toBeNull();
      expect(result?.rule_name).toBe("Weekend Surge");
    });

    it("returns null when not found", async () => {
      vi.mocked(query).mockResolvedValueOnce(emptyResult);

      const result = await getPricingRuleById("nonexistent", TENANT_ID);

      expect(result).toBeNull();
    });
  });

  describe("listRateRecommendations", () => {
    it("returns mapped recommendations", async () => {
      vi.mocked(query).mockResolvedValueOnce({
        ...emptyResult,
        rows: [
          {
            recommendation_id: "rec-001",
            tenant_id: TENANT_ID,
            property_id: PROPERTY_ID,
            property_name: "City Center Hotel",
            room_type_id: null,
            room_type_name: null,
            rate_plan_id: null,
            recommendation_date: "2026-03-15",
            current_rate: "200.00",
            recommended_rate: "230.00",
            confidence_score: "0.85",
            recommendation_reason: "High demand period",
            status: "PENDING",
            applied_at: null,
            created_at: "2026-02-01T00:00:00Z",
          },
        ],
        rowCount: 1,
      });

      const results = await listRateRecommendations({ tenantId: TENANT_ID });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        current_rate: 200,
        recommended_rate: 230,
        confidence_score: 0.85,
        status: "PENDING",
      });
    });
  });

  describe("listCompetitorRates", () => {
    it("returns mapped competitor rates with default currency", async () => {
      vi.mocked(query).mockResolvedValueOnce({
        ...emptyResult,
        rows: [
          {
            competitor_rate_id: "cr-001",
            tenant_id: TENANT_ID,
            property_id: PROPERTY_ID,
            property_name: null,
            competitor_name: "Hilton Downtown",
            competitor_property_name: null,
            room_type_category: "STANDARD",
            rate_date: "2026-03-15",
            rate_amount: "189.00",
            currency: null,
            source: "SCRAPER",
            collected_at: null,
            created_at: "2026-02-10T00:00:00Z",
          },
        ],
        rowCount: 1,
      });

      const results = await listCompetitorRates({ tenantId: TENANT_ID });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        competitor_name: "Hilton Downtown",
        rate_amount: 189,
        currency: "USD",
      });
    });
  });

  describe("listDemandCalendar", () => {
    it("returns mapped demand calendar entries", async () => {
      vi.mocked(query).mockResolvedValueOnce({
        ...emptyResult,
        rows: [
          {
            calendar_id: "dc-001",
            tenant_id: TENANT_ID,
            property_id: PROPERTY_ID,
            property_name: "City Center Hotel",
            calendar_date: "2026-03-15",
            day_of_week: "SATURDAY",
            demand_level: "HIGH",
            occupancy_forecast: "92.5",
            booking_pace: "15",
            events: null,
            notes: "Conference weekend",
            created_at: "2026-02-01T00:00:00Z",
            updated_at: null,
          },
        ],
        rowCount: 1,
      });

      const results = await listDemandCalendar({ tenantId: TENANT_ID });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        demand_level: "HIGH",
        occupancy_forecast: 92.5,
        booking_pace: 15,
        notes: "Conference weekend",
      });
    });
  });
});
