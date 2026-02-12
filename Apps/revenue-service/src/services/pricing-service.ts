import { query } from "../lib/db.js";
import {
  COMPETITOR_RATE_LIST_SQL,
  DEMAND_CALENDAR_LIST_SQL,
  PRICING_RULE_BY_ID_SQL,
  PRICING_RULE_LIST_SQL,
  RATE_RECOMMENDATION_LIST_SQL,
} from "../sql/pricing-queries.js";

const toIsoString = (value: string | Date | null | undefined): string | undefined => {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
};

const toDateString = (value: string | Date | null | undefined): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).split("T")[0];
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// ============================================================================
// PRICING RULES
// ============================================================================

type PricingRuleRow = {
  rule_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  rule_name: string;
  rule_description?: string | null;
  rule_type: string;
  priority: number;
  is_active: boolean;
  effective_from: string | Date | null;
  effective_to: string | Date | null;
  applies_to_room_types: string[] | null;
  applies_to_rate_plans: string[] | null;
  condition_type: string | null;
  condition_value: unknown;
  condition_operator?: string | null;
  adjustment_type: string | null;
  adjustment_value: number | string | null;
  min_rate: number | string | null;
  max_rate: number | string | null;
  compound_with?: string[] | null;
  metadata?: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

export type PricingRuleListItem = {
  rule_id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  rule_name: string;
  rule_type: string;
  priority: number;
  is_active: boolean;
  effective_from?: string;
  effective_to?: string;
  applies_to_room_types?: string[];
  applies_to_rate_plans?: string[];
  condition_type?: string;
  adjustment_type?: string;
  adjustment_value?: number;
  min_rate?: number;
  max_rate?: number;
  created_at: string;
  updated_at?: string;
};

const mapRowToPricingRule = (row: PricingRuleRow): PricingRuleListItem => ({
  rule_id: row.rule_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  rule_name: row.rule_name,
  rule_type: row.rule_type,
  priority: row.priority,
  is_active: row.is_active,
  effective_from: toDateString(row.effective_from),
  effective_to: toDateString(row.effective_to),
  applies_to_room_types: row.applies_to_room_types ?? undefined,
  applies_to_rate_plans: row.applies_to_rate_plans ?? undefined,
  condition_type: row.condition_type ?? undefined,
  adjustment_type: row.adjustment_type ?? undefined,
  adjustment_value: row.adjustment_value != null ? toNumber(row.adjustment_value) : undefined,
  min_rate: row.min_rate != null ? toNumber(row.min_rate) : undefined,
  max_rate: row.max_rate != null ? toNumber(row.max_rate) : undefined,
  created_at: toIsoString(row.created_at) ?? "",
  updated_at: toIsoString(row.updated_at),
});

export const listPricingRules = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  ruleType?: string;
  isActive?: boolean;
  offset?: number;
}): Promise<PricingRuleListItem[]> => {
  const { rows } = await query<PricingRuleRow>(PRICING_RULE_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.ruleType ?? null,
    options.isActive ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToPricingRule);
};

export const getPricingRuleById = async (
  ruleId: string,
  tenantId: string,
): Promise<PricingRuleListItem | null> => {
  const { rows } = await query<PricingRuleRow>(PRICING_RULE_BY_ID_SQL, [ruleId, tenantId]);
  const [row] = rows;
  return row ? mapRowToPricingRule(row) : null;
};

// ============================================================================
// RATE RECOMMENDATIONS
// ============================================================================

type RateRecommendationRow = {
  recommendation_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  room_type_id: string | null;
  room_type_name: string | null;
  rate_plan_id: string | null;
  recommendation_date: string | Date;
  current_rate: number | string;
  recommended_rate: number | string;
  confidence_score: number | string | null;
  recommendation_reason: string | null;
  status: string | null;
  applied_at: string | Date | null;
  created_at: string | Date;
};

export type RateRecommendationListItem = {
  recommendation_id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  room_type_id?: string;
  room_type_name?: string;
  rate_plan_id?: string;
  recommendation_date: string;
  current_rate: number;
  recommended_rate: number;
  confidence_score?: number;
  recommendation_reason?: string;
  status?: string;
  applied_at?: string;
  created_at: string;
};

const mapRowToRecommendation = (row: RateRecommendationRow): RateRecommendationListItem => ({
  recommendation_id: row.recommendation_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  room_type_id: row.room_type_id ?? undefined,
  room_type_name: row.room_type_name ?? undefined,
  rate_plan_id: row.rate_plan_id ?? undefined,
  recommendation_date: toDateString(row.recommendation_date) ?? "",
  current_rate: toNumber(row.current_rate),
  recommended_rate: toNumber(row.recommended_rate),
  confidence_score: row.confidence_score != null ? toNumber(row.confidence_score) : undefined,
  recommendation_reason: row.recommendation_reason ?? undefined,
  status: row.status ?? undefined,
  applied_at: toIsoString(row.applied_at),
  created_at: toIsoString(row.created_at) ?? "",
});

export const listRateRecommendations = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  recommendationDate?: string;
  offset?: number;
}): Promise<RateRecommendationListItem[]> => {
  const { rows } = await query<RateRecommendationRow>(RATE_RECOMMENDATION_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.status ?? null,
    options.recommendationDate ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToRecommendation);
};

// ============================================================================
// COMPETITOR RATES
// ============================================================================

type CompetitorRateRow = {
  competitor_rate_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  competitor_name: string;
  competitor_property_name: string | null;
  room_type_category: string | null;
  rate_date: string | Date;
  rate_amount: number | string;
  currency: string | null;
  source: string | null;
  collected_at: string | Date | null;
  created_at: string | Date;
};

export type CompetitorRateListItem = {
  competitor_rate_id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  competitor_name: string;
  competitor_property_name?: string;
  room_type_category?: string;
  rate_date: string;
  rate_amount: number;
  currency: string;
  source?: string;
  collected_at?: string;
  created_at: string;
};

const mapRowToCompetitorRate = (row: CompetitorRateRow): CompetitorRateListItem => ({
  competitor_rate_id: row.competitor_rate_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  competitor_name: row.competitor_name,
  competitor_property_name: row.competitor_property_name ?? undefined,
  room_type_category: row.room_type_category ?? undefined,
  rate_date: toDateString(row.rate_date) ?? "",
  rate_amount: toNumber(row.rate_amount),
  currency: row.currency ?? "USD",
  source: row.source ?? undefined,
  collected_at: toIsoString(row.collected_at),
  created_at: toIsoString(row.created_at) ?? "",
});

export const listCompetitorRates = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  rateDate?: string;
  offset?: number;
}): Promise<CompetitorRateListItem[]> => {
  const { rows } = await query<CompetitorRateRow>(COMPETITOR_RATE_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.rateDate ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToCompetitorRate);
};

// ============================================================================
// DEMAND CALENDAR
// ============================================================================

type DemandCalendarRow = {
  calendar_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  calendar_date: string | Date;
  day_of_week: string | null;
  demand_level: string | null;
  occupancy_forecast: number | string | null;
  booking_pace: number | string | null;
  events: unknown;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

export type DemandCalendarListItem = {
  calendar_id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  calendar_date: string;
  day_of_week?: string;
  demand_level?: string;
  occupancy_forecast?: number;
  booking_pace?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
};

const mapRowToDemandCalendar = (row: DemandCalendarRow): DemandCalendarListItem => ({
  calendar_id: row.calendar_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  calendar_date: toDateString(row.calendar_date) ?? "",
  day_of_week: row.day_of_week ?? undefined,
  demand_level: row.demand_level ?? undefined,
  occupancy_forecast: row.occupancy_forecast != null ? toNumber(row.occupancy_forecast) : undefined,
  booking_pace: row.booking_pace != null ? toNumber(row.booking_pace) : undefined,
  notes: row.notes ?? undefined,
  created_at: toIsoString(row.created_at) ?? "",
  updated_at: toIsoString(row.updated_at),
});

export const listDemandCalendar = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  dateFrom?: string;
  dateTo?: string;
  offset?: number;
}): Promise<DemandCalendarListItem[]> => {
  const { rows } = await query<DemandCalendarRow>(DEMAND_CALENDAR_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.dateFrom ?? null,
    options.dateTo ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToDemandCalendar);
};
