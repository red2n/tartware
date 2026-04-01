import type {
  BudgetVarianceItem,
  BudgetVarianceRow,
  DailyReportRow,
  ForecastRow,
  LastYearRow,
} from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toNumber } from "../lib/row-mappers.js";
import {
  BUDGET_VARIANCE_REPORT_SQL,
  MANAGERS_DAILY_REPORT_SQL,
  MANAGERS_FORECAST_SQL,
  MANAGERS_LAST_YEAR_SQL,
} from "../sql/goal-queries.js";

// ============================================================================
// BUDGET VARIANCE REPORT (R9)
// ============================================================================

const mapRowToVariance = (row: BudgetVarianceRow): BudgetVarianceItem => ({
  goal_id: row.goal_id,
  goal_name: row.goal_name,
  goal_type: row.goal_type,
  goal_period: row.goal_period,
  goal_category: row.goal_category ?? undefined,
  department: row.department ?? undefined,
  period_start: toDateString(row.period_start_date) ?? "",
  period_end: toDateString(row.period_end_date) ?? "",
  budgeted_amount: row.budgeted_amount != null ? toNumber(row.budgeted_amount) : null,
  actual_amount: row.actual_amount != null ? toNumber(row.actual_amount) : null,
  variance_amount: row.variance_amount != null ? toNumber(row.variance_amount) : null,
  variance_percent: row.variance_percent != null ? toNumber(row.variance_percent) : null,
  variance_status: row.variance_status ?? undefined,
  progress_percent: row.progress_percent != null ? toNumber(row.progress_percent) : null,
  last_year_actual: row.last_year_actual != null ? toNumber(row.last_year_actual) : null,
  yoy_growth_percent:
    row.yoy_growth_actual_percent != null ? toNumber(row.yoy_growth_actual_percent) : null,
  daily_run_rate_required:
    row.daily_run_rate_required != null ? toNumber(row.daily_run_rate_required) : null,
  daily_run_rate_actual:
    row.daily_run_rate_actual != null ? toNumber(row.daily_run_rate_actual) : null,
});

export const getBudgetVarianceReport = async (opts: {
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  department?: string;
  goalType?: string;
  limit?: number;
  offset?: number;
}): Promise<BudgetVarianceItem[]> => {
  const { rows } = await query<BudgetVarianceRow>(BUDGET_VARIANCE_REPORT_SQL, [
    opts.tenantId,
    opts.propertyId,
    opts.startDate,
    opts.endDate,
    opts.department ?? null,
    opts.goalType ?? null,
    opts.limit ?? 100,
    opts.offset ?? 0,
  ]);
  return rows.map(mapRowToVariance);
};

// ============================================================================
// MANAGER'S DAILY REPORT (R10)
// ============================================================================

const mapForecastRow = (row: ForecastRow) => ({
  forecast_date: toDateString(row.forecast_date) ?? "",
  occupancy_forecast: row.occupancy_forecast != null ? toNumber(row.occupancy_forecast) : null,
  adr_forecast: row.adr_forecast != null ? toNumber(row.adr_forecast) : null,
  revpar_forecast: row.revpar_forecast != null ? toNumber(row.revpar_forecast) : null,
  room_revenue_forecast:
    row.room_revenue_forecast != null ? toNumber(row.room_revenue_forecast) : null,
  confidence_level: row.confidence_level != null ? toNumber(row.confidence_level) : null,
});

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const getManagersDailyReport = async (
  propertyId: string,
  tenantId: string,
  businessDate: string,
) => {
  // Run main report, forecasts (7/14/30), and last year in parallel
  const [mainResult, forecast7, forecast14, forecast30, lyResult] = await Promise.all([
    query<DailyReportRow>(MANAGERS_DAILY_REPORT_SQL, [propertyId, tenantId, businessDate]),
    query<ForecastRow>(MANAGERS_FORECAST_SQL, [propertyId, tenantId, businessDate, 7]),
    query<ForecastRow>(MANAGERS_FORECAST_SQL, [propertyId, tenantId, businessDate, 14]),
    query<ForecastRow>(MANAGERS_FORECAST_SQL, [propertyId, tenantId, businessDate, 30]),
    query<LastYearRow>(MANAGERS_LAST_YEAR_SQL, [propertyId, tenantId, businessDate]),
  ]);

  const main = mainResult.rows[0];
  const ly = lyResult.rows[0];

  const totalRooms = main ? toNumber(main.total_rooms) : 0;
  const roomsSold = main ? toNumber(main.rooms_sold) : 0;
  const roomRevenue = main ? toNumber(main.room_revenue) : 0;
  const totalRevenue = main ? toNumber(main.total_revenue) : 0;

  const occupancyPct = totalRooms > 0 ? (roomsSold / totalRooms) * 100 : 0;
  const adr = roomsSold > 0 ? roomRevenue / roomsSold : 0;
  const revpar = totalRooms > 0 ? roomRevenue / totalRooms : 0;
  const trevpar = totalRooms > 0 ? totalRevenue / totalRooms : 0;

  // Parse JSONB aggregates
  const segmentMix = Array.isArray(main?.segment_mix)
    ? (main.segment_mix as Array<{ segment: string; reservations: number; revenue: number }>)
    : [];
  const budgetComparison = Array.isArray(main?.budget_comparison)
    ? (main.budget_comparison as Array<{
        goal_type: string;
        budgeted: number | null;
        actual: number | null;
        variance_pct: number | null;
      }>)
    : [];

  // Last year comparison
  let lastYear = null;
  if (ly) {
    const lyTotalRooms = toNumber(ly.ly_total_rooms);
    const lyRoomsSold = toNumber(ly.ly_rooms_sold);
    const lyRoomRevenue = toNumber(ly.ly_room_revenue);
    const lyTotalRevenue = toNumber(ly.ly_total_revenue);
    const lyOcc = lyTotalRooms > 0 ? (lyRoomsSold / lyTotalRooms) * 100 : 0;
    const lyAdr = lyRoomsSold > 0 ? lyRoomRevenue / lyRoomsSold : 0;
    const lyRevpar = lyTotalRooms > 0 ? lyRoomRevenue / lyTotalRooms : 0;

    lastYear = {
      rooms_sold: lyRoomsSold,
      total_rooms: lyTotalRooms,
      occupancy_percent: round2(lyOcc),
      room_revenue: round2(lyRoomRevenue),
      total_revenue: round2(lyTotalRevenue),
      adr: round2(lyAdr),
      revpar: round2(lyRevpar),
    };
  }

  return {
    property_id: propertyId,
    business_date: businessDate,
    occupancy: {
      total_rooms: totalRooms,
      rooms_sold: roomsSold,
      rooms_available: main ? toNumber(main.rooms_available) : 0,
      rooms_ooo: main ? toNumber(main.rooms_ooo) : 0,
      rooms_oos: main ? toNumber(main.rooms_oos) : 0,
      occupancy_percent: round2(occupancyPct),
    },
    revenue: {
      room_revenue: round2(roomRevenue),
      fb_revenue: main ? round2(toNumber(main.fb_revenue)) : 0,
      other_revenue: main ? round2(toNumber(main.other_revenue)) : 0,
      total_revenue: round2(totalRevenue),
    },
    rate_metrics: {
      adr: round2(adr),
      revpar: round2(revpar),
      trevpar: round2(trevpar),
    },
    movements: {
      expected_arrivals: main ? toNumber(main.expected_arrivals) : 0,
      actual_arrivals: main ? toNumber(main.actual_arrivals) : 0,
      expected_departures: main ? toNumber(main.expected_departures) : 0,
      actual_departures: main ? toNumber(main.actual_departures) : 0,
      in_house_guests: main ? toNumber(main.in_house_guests) : 0,
      no_shows: main ? toNumber(main.no_shows) : 0,
    },
    segment_mix: segmentMix,
    budget_comparison: budgetComparison,
    forecast: {
      next_7_days: forecast7.rows.map(mapForecastRow),
      next_14_days: forecast14.rows.map(mapForecastRow),
      next_30_days: forecast30.rows.map(mapForecastRow),
    },
    last_year: lastYear,
  };
};
