import { query } from "../lib/db.js";
import {
  REVENUE_FORECAST_LIST_SQL,
  REVENUE_GOAL_LIST_SQL,
  REVENUE_KPI_SQL,
} from "../sql/report-queries.js";

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
// REVENUE FORECASTS
// ============================================================================

type RevenueForecastRow = {
  forecast_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  forecast_date: string | Date;
  forecast_period: string | null;
  room_revenue_forecast: number | string | null;
  total_revenue_forecast: number | string | null;
  occupancy_forecast: number | string | null;
  adr_forecast: number | string | null;
  revpar_forecast: number | string | null;
  confidence_level: number | string | null;
  scenario_type: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

export type RevenueForecastListItem = {
  forecast_id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  forecast_date: string;
  forecast_period?: string;
  room_revenue_forecast?: number;
  total_revenue_forecast?: number;
  occupancy_forecast?: number;
  adr_forecast?: number;
  revpar_forecast?: number;
  confidence_level?: number;
  scenario_type?: string;
  created_at: string;
  updated_at?: string;
};

const mapRowToForecast = (row: RevenueForecastRow): RevenueForecastListItem => ({
  forecast_id: row.forecast_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  forecast_date: toDateString(row.forecast_date) ?? "",
  forecast_period: row.forecast_period ?? undefined,
  room_revenue_forecast:
    row.room_revenue_forecast != null ? toNumber(row.room_revenue_forecast) : undefined,
  total_revenue_forecast:
    row.total_revenue_forecast != null ? toNumber(row.total_revenue_forecast) : undefined,
  occupancy_forecast: row.occupancy_forecast != null ? toNumber(row.occupancy_forecast) : undefined,
  adr_forecast: row.adr_forecast != null ? toNumber(row.adr_forecast) : undefined,
  revpar_forecast: row.revpar_forecast != null ? toNumber(row.revpar_forecast) : undefined,
  confidence_level: row.confidence_level != null ? toNumber(row.confidence_level) : undefined,
  scenario_type: row.scenario_type ?? undefined,
  created_at: toIsoString(row.created_at) ?? "",
  updated_at: toIsoString(row.updated_at),
});

export const listRevenueForecasts = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  forecastPeriod?: string;
  scenarioType?: string;
  offset?: number;
}): Promise<RevenueForecastListItem[]> => {
  const { rows } = await query<RevenueForecastRow>(REVENUE_FORECAST_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.forecastPeriod ?? null,
    options.scenarioType ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToForecast);
};

// ============================================================================
// REVENUE GOALS
// ============================================================================

type RevenueGoalRow = {
  goal_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  goal_name: string;
  goal_type: string | null;
  period_start: string | Date;
  period_end: string | Date;
  target_amount: number | string;
  actual_amount: number | string | null;
  variance_amount: number | string | null;
  variance_percent: number | string | null;
  status: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

export type RevenueGoalListItem = {
  goal_id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  goal_name: string;
  goal_type?: string;
  period_start: string;
  period_end: string;
  target_amount: number;
  actual_amount?: number;
  variance_amount?: number;
  variance_percent?: number;
  status?: string;
  created_at: string;
  updated_at?: string;
};

const mapRowToGoal = (row: RevenueGoalRow): RevenueGoalListItem => ({
  goal_id: row.goal_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  goal_name: row.goal_name,
  goal_type: row.goal_type ?? undefined,
  period_start: toDateString(row.period_start) ?? "",
  period_end: toDateString(row.period_end) ?? "",
  target_amount: toNumber(row.target_amount),
  actual_amount: row.actual_amount != null ? toNumber(row.actual_amount) : undefined,
  variance_amount: row.variance_amount != null ? toNumber(row.variance_amount) : undefined,
  variance_percent: row.variance_percent != null ? toNumber(row.variance_percent) : undefined,
  status: row.status ?? undefined,
  created_at: toIsoString(row.created_at) ?? "",
  updated_at: toIsoString(row.updated_at),
});

export const listRevenueGoals = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  goalType?: string;
  status?: string;
  offset?: number;
}): Promise<RevenueGoalListItem[]> => {
  const { rows } = await query<RevenueGoalRow>(REVENUE_GOAL_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.goalType ?? null,
    options.status ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToGoal);
};

// ============================================================================
// REVENUE KPIs
// ============================================================================

type KpiRow = {
  occupied_rooms: string | number;
  total_rooms: string | number;
  room_revenue: string | number;
  total_revenue: string | number;
};

export type RevenueKpi = {
  property_id: string;
  business_date: string;
  occupied_rooms: number;
  total_rooms: number;
  occupancy_percent: number;
  room_revenue: number;
  total_revenue: number;
  adr: number;
  revpar: number;
};

export const getRevenueKpis = async (
  propertyId: string,
  tenantId: string,
  businessDate: string,
): Promise<RevenueKpi> => {
  const { rows } = await query<KpiRow>(REVENUE_KPI_SQL, [propertyId, tenantId, businessDate]);
  const row = rows[0];

  const occupied = row ? toNumber(row.occupied_rooms) : 0;
  const total = row ? toNumber(row.total_rooms) : 0;
  const roomRev = row ? toNumber(row.room_revenue) : 0;
  const totalRev = row ? toNumber(row.total_revenue) : 0;

  const occupancy = total > 0 ? (occupied / total) * 100 : 0;
  const adr = occupied > 0 ? roomRev / occupied : 0;
  const revpar = total > 0 ? roomRev / total : 0;

  return {
    property_id: propertyId,
    business_date: businessDate,
    occupied_rooms: occupied,
    total_rooms: total,
    occupancy_percent: Math.round(occupancy * 100) / 100,
    room_revenue: Math.round(roomRev * 100) / 100,
    total_revenue: Math.round(totalRev * 100) / 100,
    adr: Math.round(adr * 100) / 100,
    revpar: Math.round(revpar * 100) / 100,
  };
};
