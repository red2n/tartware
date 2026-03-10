import type { CommandMetadata } from "@tartware/command-consumer-utils";
import { forEachDateInRange } from "../../lib/date-range.js";
import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { toNumber } from "../../lib/row-mappers.js";
import { upsertHurdleRate } from "../../services/hurdle-rate-service.js";

const logger = appLogger.child({ module: "hurdle-rate-handlers" });

export const handleHurdleRateSet = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ upserted: number; roomTypeId: unknown }> => {
  const upserted = await forEachDateInRange(
    payload.start_date as string,
    payload.end_date as string,
    async (dateStr) => {
      await upsertHurdleRate(
        metadata.tenantId,
        payload.property_id as string,
        {
          roomTypeId: payload.room_type_id as string,
          hurdleDate: dateStr,
          hurdleRate: payload.hurdle_rate as number,
          currency: (payload.currency as string) ?? "USD",
          segment: (payload.segment as string) ?? null,
          source: (payload.source as string) ?? "manual",
          isActive: true,
          notes: (payload.notes as string) ?? null,
          metadata: (payload.metadata as Record<string, unknown>) ?? null,
        },
        actorId,
      );
    },
  );
  return { upserted, roomTypeId: payload.room_type_id };
};

/**
 * SQL to compute displacement-based hurdle rates.
 *
 * For each room type on each date, calculates the opportunity cost
 * of selling a room at a given rate — based on:
 * 1. Average transient ADR for the period (what the room could earn)
 * 2. Forecasted occupancy (how likely the room is to sell at full price)
 * 3. Demand level from demand_calendar
 *
 * Hurdle rate = transientADR × occupancyFactor × demandMultiplier
 * A room should not be sold below this rate.
 */
const DISPLACEMENT_HURDLE_SQL = `
  WITH room_type_ids AS (
    SELECT id AS room_type_id, type_name, base_rate
    FROM room_types
    WHERE tenant_id = $1::uuid
      AND property_id = $2::uuid
      AND ($5::uuid IS NULL OR id = $5::uuid)
      AND COALESCE(is_deleted, false) = false
  ),
  transient_adr AS (
    SELECT
      r.room_type_id,
      AVG(r.room_rate) AS avg_transient_adr,
      COUNT(DISTINCT r.id) AS transient_bookings
    FROM reservations r
    WHERE r.tenant_id = $1::uuid
      AND r.property_id = $2::uuid
      AND r.group_id IS NULL
      AND r.status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND r.is_deleted = false
      AND r.check_in_date >= ($3::date - INTERVAL '90 days')
      AND r.check_in_date <= $4::date
    GROUP BY r.room_type_id
  ),
  total_rooms AS (
    SELECT
      room_type_id,
      COUNT(*) AS room_count
    FROM rooms
    WHERE tenant_id = $1::uuid
      AND property_id = $2::uuid
      AND status NOT IN ('OUT_OF_ORDER', 'OUT_OF_SERVICE')
      AND COALESCE(is_deleted, false) = false
    GROUP BY room_type_id
  )
  SELECT
    rt.room_type_id,
    rt.type_name,
    rt.base_rate,
    COALESCE(ta.avg_transient_adr, rt.base_rate) AS avg_transient_adr,
    COALESCE(ta.transient_bookings, 0) AS transient_bookings,
    COALESCE(tr.room_count, 1) AS room_count
  FROM room_type_ids rt
  LEFT JOIN transient_adr ta ON ta.room_type_id = rt.room_type_id
  LEFT JOIN total_rooms tr ON tr.room_type_id = rt.room_type_id
`;

const DEMAND_FOR_DATE_SQL = `
  SELECT demand_level, occupancy_forecast
  FROM demand_calendar
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND calendar_date = $3::date
    AND COALESCE(is_deleted, false) = false
  LIMIT 1
`;

const FORECAST_FOR_DATE_SQL = `
  SELECT occupancy_percent
  FROM revenue_forecasts
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND forecast_date = $3::date
    AND forecast_scenario = 'base'
    AND COALESCE(is_deleted, false) = false
  ORDER BY created_at DESC
  LIMIT 1
`;

/**
 * Auto-calculate hurdle rates based on displacement analysis.
 *
 * For each room_type × date in the range:
 * - Looks up average transient ADR (what a room earns on a typical transient booking)
 * - Applies occupancy/demand multiplier (higher demand → higher hurdle)
 * - Ensures hurdle rate is between 50% and 150% of base rate
 * - Upserts calculated hurdle rates with source = 'calculated'
 */
export const handleHurdleRateCalculate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ calculated: number; roomTypes: number }> => {
  const tenantId = metadata.tenantId;
  const propertyId = payload.property_id as string;
  const startDate = payload.start_date as string;
  const endDate = payload.end_date as string;
  const roomTypeId = (payload.room_type_id as string) ?? null;
  const segment = (payload.segment as string) ?? null;
  const confidenceThreshold = (payload.confidence_threshold as number) ?? 70;

  // 1. Get room type data with transient ADR
  const { rows: roomTypeRows } = await query<{
    room_type_id: string;
    type_name: string;
    base_rate: string;
    avg_transient_adr: string;
    transient_bookings: string;
    room_count: string;
  }>(DISPLACEMENT_HURDLE_SQL, [tenantId, propertyId, startDate, endDate, roomTypeId]);

  if (roomTypeRows.length === 0) {
    logger.warn({ tenantId, propertyId }, "no room types found for hurdle rate calculation");
    return { calculated: 0, roomTypes: 0 };
  }

  let totalCalculated = 0;

  for (const rt of roomTypeRows) {
    const baseRate = toNumber(rt.base_rate);
    const avgTransientAdr = toNumber(rt.avg_transient_adr, baseRate);
    const transientBookings = toNumber(rt.transient_bookings);
    const minHurdle = baseRate * 0.5;
    const maxHurdle = baseRate * 1.5;

    // Confidence based on data availability
    let confidence = 50;
    if (transientBookings > 50) confidence += 20;
    else if (transientBookings > 20) confidence += 10;

    await forEachDateInRange(startDate, endDate, async (dateStr) => {
      // Look up demand and forecast signals for this date
      const [demandResult, forecastResult] = await Promise.all([
        query<{ demand_level: string; occupancy_forecast: string }>(DEMAND_FOR_DATE_SQL, [
          tenantId,
          propertyId,
          dateStr,
        ]),
        query<{ occupancy_percent: string }>(FORECAST_FOR_DATE_SQL, [
          tenantId,
          propertyId,
          dateStr,
        ]),
      ]);

      const demandLevel = demandResult.rows[0]?.demand_level ?? "MODERATE";
      const forecastOcc = forecastResult.rows[0]?.occupancy_percent
        ? toNumber(forecastResult.rows[0].occupancy_percent)
        : null;

      // Demand multiplier: higher demand → higher hurdle
      let demandMultiplier = 1.0;
      switch (demandLevel) {
        case "BLACKOUT":
        case "PEAK":
          demandMultiplier = 1.25;
          break;
        case "HIGH":
          demandMultiplier = 1.1;
          break;
        case "MODERATE":
          demandMultiplier = 1.0;
          break;
        case "LOW":
          demandMultiplier = 0.85;
          break;
      }

      // Occupancy factor: higher forecasted occupancy → higher hurdle
      let occFactor = 1.0;
      if (forecastOcc != null) {
        confidence += 5;
        if (forecastOcc >= 90) occFactor = 1.15;
        else if (forecastOcc >= 75) occFactor = 1.05;
        else if (forecastOcc >= 50) occFactor = 1.0;
        else if (forecastOcc >= 30) occFactor = 0.9;
        else occFactor = 0.8;
      }

      // Calculate hurdle rate
      let hurdleRate = avgTransientAdr * demandMultiplier * occFactor;
      hurdleRate = Math.max(minHurdle, Math.min(maxHurdle, hurdleRate));
      hurdleRate = Math.round(hurdleRate * 100) / 100;

      const effectiveConfidence = Math.min(100, confidence);

      if (effectiveConfidence < confidenceThreshold) {
        return; // Skip low-confidence calculations
      }

      const displacementAnalysis = {
        avg_transient_adr: avgTransientAdr,
        demand_level: demandLevel,
        demand_multiplier: demandMultiplier,
        forecast_occupancy: forecastOcc,
        occupancy_factor: occFactor,
        transient_bookings_sample: transientBookings,
      };

      await upsertHurdleRate(
        tenantId,
        propertyId,
        {
          roomTypeId: rt.room_type_id,
          hurdleDate: dateStr,
          hurdleRate,
          currency: "USD",
          segment: segment ?? null,
          source: "calculated",
          displacementAnalysis,
          confidenceScore: effectiveConfidence,
          isActive: true,
          notes: `Auto-calculated from displacement analysis (ADR: $${avgTransientAdr.toFixed(2)}, demand: ${demandLevel})`,
          metadata: null,
        },
        actorId,
      );

      totalCalculated++;
    });
  }

  logger.info(
    { tenantId, propertyId, calculated: totalCalculated, roomTypes: roomTypeRows.length },
    "hurdle rates auto-calculated",
  );

  return { calculated: totalCalculated, roomTypes: roomTypeRows.length };
};
