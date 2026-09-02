import { appLogger } from "../lib/logger.js";
import {
  countForecastableRooms,
  fetchDemandFactors,
  fetchTrainingHistory,
  insertForecast,
} from "../repositories/forecast-repository.js";

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
  const totalRooms = await countForecastableRooms(params.tenantId, params.propertyId);

  // Gather historical daily aggregates
  const historyRows = await fetchTrainingHistory(
    params.tenantId,
    params.propertyId,
    trainingStart.toISOString().slice(0, 10),
  );

  if (historyRows.length === 0) {
    logger.warn({ propertyId: params.propertyId }, "No historical data for forecast computation");
    return { forecastsGenerated: 0, forecastDate };
  }

  // Compute exponential moving averages (decay factor: 0.97/day — recent data weighted ~3x more)
  const decay = 0.97;
  const n = historyRows.length;
  let weightedOcc = 0;
  let weightedAdr = 0;
  let weightedRev = 0;
  let totalWeight = 0;

  for (let i = 0; i < n; i++) {
    const weight = decay ** (n - 1 - i);
    const row = historyRows[i];
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
  const demandFactorRows = await fetchDemandFactors(
    params.tenantId,
    params.propertyId,
    horizonEnd.toISOString().slice(0, 10),
  );

  const eventDataByDate = new Map<string, { eventFactor: number; seasonFactor: number }>();
  for (const row of demandFactorRows) {
    const impact = row.event_impact_score ? Number(row.event_impact_score) : 0;
    const season = row.season_factor ? Number(row.season_factor) : 1.0;
    // event_impact_score 0-100 maps to 1.0-1.5 multiplier (50 = 1.25x boost)
    const eventFactor = 1 + impact / 200;
    eventDataByDate.set(row.calendar_date, { eventFactor, seasonFactor: season });
  }

  let forecastsGenerated = 0;

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
    await insertForecast({
      tenantId: params.tenantId,
      propertyId: params.propertyId,
      forecastDate,
      forecastPeriod: params.forecastPeriod,
      periodStart: period.start.toISOString().slice(0, 10),
      periodEnd: period.end.toISOString().slice(0, 10),
      scenario: period.scenario,
      roomRevenue: period.roomRev,
      // Room revenue plus a flat 15% ancillary assumption.
      totalRevenue: period.roomRev * 1.15,
      confidence: period.confidence,
      occupancyPercent: Math.round(period.occPct * 100) / 100,
      adr: Math.round(period.adr * 100) / 100,
      revpar: Math.round(period.revpar * 100) / 100,
      actorId: params.actorId,
    });
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
