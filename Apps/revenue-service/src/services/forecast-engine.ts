import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "forecast-engine" });

/**
 * Compute revenue forecasts for a property using historical reservation data.
 *
 * Uses an exponential moving average (EMA) approach:
 * 1. Gather historical occupancy, ADR, and room revenue over the training window
 * 2. Compute weighted averages with more recent data weighted higher
 * 3. Project forward for each scenario with appropriate multipliers
 * 4. Insert forecast rows into revenue_forecasts table
 */
export async function computeForecasts(params: {
  tenantId: string;
  propertyId: string;
  forecastPeriod: "daily" | "weekly" | "monthly";
  horizonDays: number;
  trainingDays: number;
  scenarios: string[];
  actorId: string;
}): Promise<{ forecastsGenerated: number; forecastDate: string }> {
  const forecastDate = new Date().toISOString().slice(0, 10);
  const trainingStart = new Date();
  trainingStart.setDate(trainingStart.getDate() - params.trainingDays);

  // Get total rooms for occupancy calculations
  const roomCountResult = await query<{ total_rooms: string }>(
    `SELECT COUNT(*) AS total_rooms FROM rooms
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND status NOT IN ('OUT_OF_ORDER')
       AND is_deleted = false`,
    [params.tenantId, params.propertyId],
  );
  const totalRooms = Number(roomCountResult.rows[0]?.total_rooms ?? 1);

  // Gather historical daily aggregates
  const historyResult = await query<{
    business_date: string;
    occupied: string;
    room_revenue: string;
    adr: string;
  }>(
    `SELECT
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
     ORDER BY d.dt`,
    [params.tenantId, params.propertyId, trainingStart.toISOString().slice(0, 10)],
  );

  if (historyResult.rows.length === 0) {
    logger.warn({ propertyId: params.propertyId }, "No historical data for forecast computation");
    return { forecastsGenerated: 0, forecastDate };
  }

  // Compute exponential moving averages (decay factor: 0.97/day — recent data weighted ~3x more)
  const decay = 0.97;
  const n = historyResult.rows.length;
  let weightedOcc = 0;
  let weightedAdr = 0;
  let weightedRev = 0;
  let totalWeight = 0;

  for (let i = 0; i < n; i++) {
    const weight = decay ** (n - 1 - i);
    const row = historyResult.rows[i];
    if (!row) continue;
    weightedOcc += (Number(row.occupied) / totalRooms) * weight;
    weightedAdr += Number(row.adr) * weight;
    weightedRev += Number(row.room_revenue) * weight;
    totalWeight += weight;
  }

  const baseOccPct = totalWeight > 0 ? (weightedOcc / totalWeight) * 100 : 0;
  const baseAdr = totalWeight > 0 ? weightedAdr / totalWeight : 0;
  const baseRoomRevenue = totalWeight > 0 ? weightedRev / totalWeight : 0;

  // Scenario multipliers
  const scenarioMultipliers: Record<string, { occ: number; adr: number }> = {
    base: { occ: 1.0, adr: 1.0 },
    optimistic: { occ: 1.12, adr: 1.08 },
    pessimistic: { occ: 0.85, adr: 0.92 },
    conservative: { occ: 0.95, adr: 0.97 },
    aggressive: { occ: 1.2, adr: 1.15 },
  };

  // Load demand calendar event/season data for the forecast horizon
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + params.horizonDays);
  const eventDataResult = await query<{
    calendar_date: string;
    event_impact_score: string | null;
    season_factor: string | null;
    events: unknown;
  }>(
    `SELECT calendar_date::text, event_impact_score, season_factor, events
     FROM demand_calendar
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND calendar_date >= CURRENT_DATE
       AND calendar_date < $3::date`,
    [params.tenantId, params.propertyId, horizonEnd.toISOString().slice(0, 10)],
  );

  const eventDataByDate = new Map<string, { eventFactor: number; seasonFactor: number }>();
  for (const row of eventDataResult.rows) {
    const impact = row.event_impact_score ? Number(row.event_impact_score) : 0;
    const season = row.season_factor ? Number(row.season_factor) : 1.0;
    // event_impact_score 0-100 maps to 1.0-1.5 multiplier (50 = 1.25x boost)
    const eventFactor = 1 + impact / 200;
    eventDataByDate.set(row.calendar_date, { eventFactor, seasonFactor: season });
  }

  let forecastsGenerated = 0;

  const FORECAST_INSERT_SQL = `INSERT INTO revenue_forecasts (
       tenant_id, property_id, forecast_date, forecast_period,
       period_start_date, period_end_date,
       forecast_type, forecast_scenario,
       forecasted_value, confidence_level,
       room_revenue_forecast, total_revenue_forecast,
       forecasted_occupancy_percent, forecasted_adr, forecasted_revpar,
       model_name, model_version,
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

  const insertForecastPeriod = async (period: {
    start: Date;
    end: Date;
    scenario: string;
    roomRev: number;
    confidence: number;
    occPct: number;
    adr: number;
    revpar: number;
  }) => {
    await query(FORECAST_INSERT_SQL, [
      params.tenantId,
      params.propertyId,
      forecastDate,
      params.forecastPeriod,
      period.start.toISOString().slice(0, 10),
      period.end.toISOString().slice(0, 10),
      period.scenario,
      period.roomRev,
      period.confidence,
      period.roomRev,
      period.roomRev * 1.15,
      Math.round(period.occPct * 100) / 100,
      Math.round(period.adr * 100) / 100,
      Math.round(period.revpar * 100) / 100,
      params.actorId,
    ]);
    forecastsGenerated++;
  };

  for (const scenario of params.scenarios) {
    const mult = scenarioMultipliers[scenario] ?? { occ: 1.0, adr: 1.0 };

    // Generate forecasts for horizon
    if (params.forecastPeriod === "daily") {
      for (let d = 0; d < params.horizonDays; d++) {
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() + d);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 1);

        const dateKey = periodStart.toISOString().slice(0, 10);
        const demandData = eventDataByDate.get(dateKey);
        const ef = demandData?.eventFactor ?? 1.0;
        const sf = demandData?.seasonFactor ?? 1.0;

        const occPct = Math.min(baseOccPct * sf * ef * mult.occ, 100);
        const adr = baseAdr * sf * ef * mult.adr;
        const revpar = (occPct / 100) * adr;
        const roomRev = baseRoomRevenue * sf * ef * mult.occ * mult.adr;

        await insertForecastPeriod({
          start: periodStart,
          end: periodEnd,
          scenario,
          roomRev,
          confidence: Math.max(60, 95 - d * 0.5),
          occPct,
          adr,
          revpar,
        });
      }
    } else {
      // Weekly or monthly: aggregate into period buckets
      const periodDays = params.forecastPeriod === "weekly" ? 7 : 30;
      const periods = Math.ceil(params.horizonDays / periodDays);

      for (let p = 0; p < periods; p++) {
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() + p * periodDays);
        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + periodDays);

        // Average event/season factors across the period
        let efSum = 0;
        let sfSum = 0;
        let daysWithData = 0;
        for (let dd = 0; dd < periodDays; dd++) {
          const dt = new Date(periodStart);
          dt.setDate(dt.getDate() + dd);
          const demandData = eventDataByDate.get(dt.toISOString().slice(0, 10));
          efSum += demandData?.eventFactor ?? 1.0;
          sfSum += demandData?.seasonFactor ?? 1.0;
          daysWithData++;
        }
        const ef = daysWithData > 0 ? efSum / daysWithData : 1.0;
        const sf = daysWithData > 0 ? sfSum / daysWithData : 1.0;

        const occPct = Math.min(baseOccPct * sf * ef * mult.occ, 100);
        const adr = baseAdr * sf * ef * mult.adr;
        const revpar = (occPct / 100) * adr;
        const roomRev = baseRoomRevenue * sf * ef * mult.occ * mult.adr * periodDays;

        await insertForecastPeriod({
          start: periodStart,
          end: periodEnd,
          scenario,
          roomRev,
          confidence: Math.max(55, 90 - p * 2),
          occPct,
          adr,
          revpar,
        });
      }
    }
  }

  logger.info(
    {
      propertyId: params.propertyId,
      forecastsGenerated,
      horizonDays: params.horizonDays,
      scenarios: params.scenarios,
      baseOccPct: Math.round(baseOccPct * 100) / 100,
      baseAdr: Math.round(baseAdr * 100) / 100,
    },
    "Forecast computation completed",
  );

  return { forecastsGenerated, forecastDate };
}
