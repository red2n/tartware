/**
 * DEV DOC
 * Module: forecast-repository.ts
 * Purpose: Data access for the revenue forecast engine — the training window it
 *          learns from, the demand factors it adjusts by, and the forecast rows
 *          it writes.
 * Ownership: revenue-service (owner of the revenue_forecasts table)
 *
 * The engine's arithmetic lives in `services/forecast-engine.ts`; this module
 * holds only the statements, so the model can be reasoned about (and tested)
 * without a database.
 */

import type {
  ForecastDemandFactorRow,
  ForecastInsertInput,
  ForecastTrainingDayRow,
} from "@tartware/schemas";

import { query } from "../lib/db.js";

// ─── SQL ─────────────────────────────────────────────────────────────────────

const ACTIVE_ROOM_COUNT_SQL = `SELECT COUNT(id) AS total_rooms FROM rooms
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND status NOT IN ('OUT_OF_ORDER')
       AND is_deleted = false`;

const TRAINING_HISTORY_SQL = `SELECT
       d.dt::date AS business_date,
       COUNT(DISTINCT r.id) AS occupied,
       COALESCE(SUM(r.room_rate), 0) AS room_revenue,
       CASE WHEN COUNT(r.id) > 0
         THEN ROUND(AVG(r.room_rate)::numeric, 2) ELSE 0 END AS adr
     FROM generate_series($3::date, CURRENT_DATE - 1, '1 day') AS d(dt)
     LEFT JOIN reservations r
       ON r.tenant_id = $1::uuid AND r.property_id = $2::uuid
       AND r.status IN ('CHECKED_IN', 'CHECKED_OUT')
       AND r.is_deleted = false
       AND r.check_in_date <= d.dt AND r.check_out_date > d.dt
     GROUP BY d.dt
     ORDER BY d.dt`;

const DEMAND_FACTORS_SQL = `SELECT calendar_date::text, event_impact_score, season_factor, events
     FROM demand_calendar
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND calendar_date >= CURRENT_DATE
       AND calendar_date < $3::date`;

const FORECAST_INSERT_SQL = `INSERT INTO revenue_forecasts (
       tenant_id, property_id, forecast_date, forecast_period,
       period_start_date, period_end_date,
       forecast_type, forecast_scenario,
       forecasted_value, confidence_level,
       room_revenue_forecast, total_revenue_forecast,
       forecasted_occupancy_percent, forecasted_adr, forecasted_revpar,
       model_algorithm, model_version,
       created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::date, $4,
       $5::date, $6::date,
       'revenue', $7,
       $8, $9,
       $10, $11,
       $12, $13, $14,
       'ema-demand-aware', '1.1',
       $15::uuid, $15::uuid
     )
     ON CONFLICT DO NOTHING`;

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * Count the rooms a forecast should divide by for occupancy. Excludes
 * out-of-order and soft-deleted rooms; falls back to 1 so a property with no
 * usable rooms cannot divide the model by zero.
 */
export const countForecastableRooms = async (
  tenantId: string,
  propertyId: string,
): Promise<number> => {
  const result = await query<{ total_rooms: string }>(ACTIVE_ROOM_COUNT_SQL, [
    tenantId,
    propertyId,
  ]);
  return Number(result.rows[0]?.total_rooms ?? 1);
};

/**
 * Daily occupancy, room revenue and ADR from `trainingStart` up to yesterday.
 * Generated off a date series, so days with no reservations come back as zero
 * rows rather than gaps the model would have to interpolate.
 */
export const fetchTrainingHistory = async (
  tenantId: string,
  propertyId: string,
  trainingStart: string,
): Promise<ForecastTrainingDayRow[]> => {
  const result = await query<ForecastTrainingDayRow>(TRAINING_HISTORY_SQL, [
    tenantId,
    propertyId,
    trainingStart,
  ]);
  return result.rows;
};

/** Demand-calendar event and season factors from today up to `horizonEnd`. */
export const fetchDemandFactors = async (
  tenantId: string,
  propertyId: string,
  horizonEnd: string,
): Promise<ForecastDemandFactorRow[]> => {
  const result = await query<ForecastDemandFactorRow>(DEMAND_FACTORS_SQL, [
    tenantId,
    propertyId,
    horizonEnd,
  ]);
  return result.rows;
};

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Persist one computed forecast. `ON CONFLICT DO NOTHING` makes a re-run for the
 * same property/date/scenario a no-op rather than a duplicate.
 */
export const insertForecast = async (input: ForecastInsertInput): Promise<void> => {
  await query(FORECAST_INSERT_SQL, [
    input.tenantId,
    input.propertyId,
    input.forecastDate,
    input.forecastPeriod,
    input.periodStart,
    input.periodEnd,
    input.scenario,
    input.roomRevenue,
    input.confidence,
    input.roomRevenue,
    input.totalRevenue,
    input.occupancyPercent,
    input.adr,
    input.revpar,
    input.actorId,
  ]);
};
