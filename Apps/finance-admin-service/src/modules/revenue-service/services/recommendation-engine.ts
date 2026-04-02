import type {
  CompetitorData,
  ComputeInput,
  ComputeResult,
  DemandEntry,
  ForecastData,
  OccupancyData,
  PricingRule,
  RecommendationResult,
  RoomTypeInfo,
} from "@tartware/schemas";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { toNumber } from "../lib/row-mappers.js";
import {
  ACTIVE_PRICING_RULES_SQL,
  AUTO_APPLY_RECOMMENDATION_SQL,
  COMPETITOR_AVG_RATE_SQL,
  DEMAND_CALENDAR_RANGE_SQL,
  FORECAST_FOR_RANGE_SQL,
  INSERT_RECOMMENDATION_SQL,
  OCCUPANCY_BY_ROOM_TYPE_SQL,
  ROOM_TYPES_FOR_PROPERTY_SQL,
  SUPERSEDE_PENDING_RECOMMENDATIONS_SQL,
} from "../sql/recommendation-queries.js";

const logger = appLogger.child({ module: "recommendation-engine" });

const MODEL_VERSION = "1.0.0";

// ── Confidence Level Mapping ─────────────────────────

function confidenceLevel(score: number): string {
  if (score >= 85) return "very_high";
  if (score >= 70) return "high";
  if (score >= 55) return "moderate";
  if (score >= 40) return "low";
  return "very_low";
}

function urgencyLevel(diffPercent: number, daysUntil: number): string {
  const absDiff = Math.abs(diffPercent);
  if (absDiff > 15 && daysUntil <= 3) return "critical";
  if (absDiff > 10 && daysUntil <= 7) return "high";
  if (absDiff > 5) return "medium";
  return "low";
}

function riskLevel(diffPercent: number): string {
  const absDiff = Math.abs(diffPercent);
  if (absDiff > 20) return "high";
  if (absDiff > 10) return "medium";
  if (absDiff > 5) return "low";
  return "very_low";
}

function recommendationAction(diffPercent: number): string {
  if (diffPercent > 10) return "significant_increase";
  if (diffPercent > 1) return "increase";
  if (diffPercent < -10) return "significant_decrease";
  if (diffPercent < -1) return "decrease";
  return "maintain";
}

function marketPosition(ownRate: number, competitorAvg: number): string {
  const ratio = ownRate / competitorAvg;
  if (ratio < 0.95) return "below_market";
  if (ratio > 1.05) return "above_market";
  return "at_market";
}

// ── Core Engine ──────────────────────────────────────

/**
 * Generate rate recommendations for a property across a date range.
 *
 * Analyzes:
 * 1. Current occupancy vs forecast occupancy
 * 2. Booking pace vs historical pace
 * 3. Competitor rate positioning
 * 4. Demand calendar signals (events, demand level)
 * 5. Active pricing rules
 *
 * Produces one recommendation per room_type × date.
 */
export async function generateRecommendations(params: {
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  roomTypeIds?: string[];
  minConfidence: number;
  autoApply: boolean;
  autoApplyThreshold: number;
  supersedeExisting: boolean;
  actorId: string;
  metadata?: Record<string, unknown>;
}): Promise<{ generated: number; autoApplied: number; results: RecommendationResult[] }> {
  const {
    tenantId,
    propertyId,
    startDate,
    endDate,
    roomTypeIds,
    minConfidence,
    autoApply,
    autoApplyThreshold,
    supersedeExisting,
    actorId,
    metadata,
  } = params;

  // 1. Fetch room types for the property
  const { rows: roomTypeRows } = await query<{
    room_type_id: string;
    type_name: string;
    base_rate: string;
    total_rooms: string;
  }>(ROOM_TYPES_FOR_PROPERTY_SQL, [tenantId, propertyId, roomTypeIds ?? null]);

  const roomTypes: RoomTypeInfo[] = roomTypeRows.map((r) => ({
    room_type_id: r.room_type_id,
    type_name: r.type_name,
    base_rate: toNumber(r.base_rate),
    total_rooms: toNumber(r.total_rooms, 1),
  }));

  if (roomTypes.length === 0) {
    logger.warn({ tenantId, propertyId }, "no room types found for property");
    return { generated: 0, autoApplied: 0, results: [] };
  }

  // 2. Fetch supporting data in parallel
  const [demandRows, competitorRows, forecastRows, pricingRuleRows] = await Promise.all([
    query<DemandEntry>(DEMAND_CALENDAR_RANGE_SQL, [tenantId, propertyId, startDate, endDate]).then(
      (r) => r.rows,
    ),
    query<{
      rate_date: string;
      avg_rate: string;
      min_rate: string;
      max_rate: string;
      competitor_count: string;
    }>(COMPETITOR_AVG_RATE_SQL, [tenantId, propertyId, startDate, endDate]).then((r) => r.rows),
    query<{
      forecast_date: string;
      occupancy_percent: string | null;
      adr: string | null;
    }>(FORECAST_FOR_RANGE_SQL, [tenantId, propertyId, startDate, endDate]).then((r) => r.rows),
    query<{
      rule_id: string;
      rule_type: string;
      adjustment_type: string;
      adjustment_value: string;
      min_rate: string | null;
      max_rate: string | null;
      applies_to_room_types: string[] | null;
    }>(ACTIVE_PRICING_RULES_SQL, [tenantId, propertyId, startDate, endDate]).then((r) => r.rows),
  ]);

  // Build lookup maps by date
  const demandByDate = new Map<string, DemandEntry>();
  for (const d of demandRows) {
    demandByDate.set(String(d.calendar_date).slice(0, 10), d);
  }

  const competitorByDate = new Map<string, CompetitorData>();
  for (const c of competitorRows) {
    competitorByDate.set(String(c.rate_date).slice(0, 10), {
      avg_rate: toNumber(c.avg_rate),
      min_rate: toNumber(c.min_rate),
      max_rate: toNumber(c.max_rate),
      competitor_count: toNumber(c.competitor_count),
    });
  }

  const forecastByDate = new Map<string, ForecastData>();
  for (const f of forecastRows) {
    forecastByDate.set(String(f.forecast_date).slice(0, 10), {
      forecast_date: String(f.forecast_date).slice(0, 10),
      occupancy_percent: f.occupancy_percent != null ? toNumber(f.occupancy_percent) : null,
      adr: f.adr != null ? toNumber(f.adr) : null,
    });
  }

  const pricingRules: PricingRule[] = pricingRuleRows.map((r) => ({
    rule_id: r.rule_id,
    rule_type: r.rule_type,
    adjustment_type: r.adjustment_type,
    adjustment_value: toNumber(r.adjustment_value),
    min_rate: r.min_rate != null ? toNumber(r.min_rate) : null,
    max_rate: r.max_rate != null ? toNumber(r.max_rate) : null,
    applies_to_room_types: r.applies_to_room_types,
  }));

  // 3. Supersede existing pending recommendations if requested
  if (supersedeExisting) {
    await query(SUPERSEDE_PENDING_RECOMMENDATIONS_SQL, [
      tenantId,
      propertyId,
      startDate,
      endDate,
      actorId,
    ]);
  }

  // 4. Iterate dates × room types and generate recommendations
  const today = new Date();
  const results: RecommendationResult[] = [];
  let autoAppliedCount = 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const daysUntilArrival = Math.max(
      0,
      Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // Fetch occupancy snapshot for this date
    const { rows: occRows } = await query<{
      room_type_id: string;
      occupied_rooms: string;
      avg_current_rate: string;
    }>(OCCUPANCY_BY_ROOM_TYPE_SQL, [tenantId, propertyId, dateStr]);

    const occupancyByType = new Map<string, OccupancyData>();
    for (const o of occRows) {
      occupancyByType.set(o.room_type_id, {
        occupied_rooms: toNumber(o.occupied_rooms),
        avg_current_rate: toNumber(o.avg_current_rate),
      });
    }

    const demand = demandByDate.get(dateStr);
    const competitor = competitorByDate.get(dateStr);
    const forecast = forecastByDate.get(dateStr);

    for (const roomType of roomTypes) {
      const occ = occupancyByType.get(roomType.room_type_id);
      const currentRate = occ?.avg_current_rate || roomType.base_rate;
      const occupiedRooms = occ?.occupied_rooms ?? 0;
      const occPercent =
        roomType.total_rooms > 0 ? (occupiedRooms / roomType.total_rooms) * 100 : 0;

      // Filter applicable pricing rules
      const applicableRules = pricingRules.filter(
        (r) => !r.applies_to_room_types || r.applies_to_room_types.includes(roomType.room_type_id),
      );

      // ── Recommendation Logic ─────────────
      const recommendation = computeRecommendedRate({
        currentRate,
        baseRate: roomType.base_rate,
        occPercent,
        forecastOccPercent: forecast?.occupancy_percent ?? null,
        forecastAdr: forecast?.adr ?? null,
        demandLevel: demand?.demand_level ?? null,
        bookingPace: demand?.booking_pace ?? null,
        paceVsLastYear:
          demand?.pace_vs_last_year != null ? toNumber(demand.pace_vs_last_year) : null,
        competitorAvg: competitor?.avg_rate ?? null,
        competitorSpread: competitor ? competitor.max_rate - competitor.min_rate : null,
        daysUntilArrival,
        applicableRules,
        minRate: Math.min(
          ...applicableRules.map((r) => r.min_rate ?? 0).filter((v) => v > 0),
          roomType.base_rate * 0.5,
        ),
        maxRate: Math.max(
          ...applicableRules.map((r) => r.max_rate ?? Infinity).filter((v) => v < Infinity),
          roomType.base_rate * 3,
        ),
      });

      if (recommendation.confidence < minConfidence) {
        continue;
      }

      const diffPercent =
        currentRate > 0 ? ((recommendation.rate - currentRate) / currentRate) * 100 : 0;

      const action = recommendationAction(diffPercent);
      if (action === "maintain" && Math.abs(diffPercent) < 1) {
        continue; // Skip trivial no-change recommendations
      }

      const urg = urgencyLevel(diffPercent, daysUntilArrival);
      const risk = riskLevel(diffPercent);
      const confLevel = confidenceLevel(recommendation.confidence);
      const mktPosition = competitor ? marketPosition(currentRate, competitor.avg_rate) : null;

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + Math.max(1, Math.min(daysUntilArrival, 7)));

      const contributingFactors = recommendation.factors;

      const dataSources: string[] = ["historical_bookings"];
      if (competitor) dataSources.push("competitor_rates");
      if (demand) dataSources.push("demand_calendar");
      if (forecast) dataSources.push("revenue_forecasts");

      // Calculate expected impacts
      const rateDiff = recommendation.rate - currentRate;
      const expectedRevenueImpact = rateDiff * roomType.total_rooms;
      const expectedOccImpact =
        rateDiff > 0 ? -Math.min(rateDiff * 0.3, 5) : Math.min(Math.abs(rateDiff) * 0.3, 5);
      const expectedRevparImpact =
        roomType.total_rooms > 0
          ? (recommendation.rate * (occPercent + expectedOccImpact)) / 100 -
            (currentRate * occPercent) / 100
          : 0;

      // Alternatives: ±5% from recommended
      const alt1 = Math.round(recommendation.rate * 0.95 * 100) / 100;
      const alt2 = Math.round(recommendation.rate * 1.05 * 100) / 100;

      const { rows: insertedRows } = await query<{ recommendation_id: string }>(
        INSERT_RECOMMENDATION_SQL,
        [
          tenantId, // $1
          propertyId, // $2
          dateStr, // $3
          roomType.room_type_id, // $4
          null, // $5 rate_plan_id
          currentRate, // $6
          recommendation.rate, // $7
          Math.round(rateDiff * 100) / 100, // $8 rate_difference
          Math.round(diffPercent * 100) / 100, // $9 rate_difference_percent
          action, // $10
          urg, // $11
          Math.round(recommendation.confidence * 100) / 100, // $12
          confLevel, // $13
          Math.round(occPercent * 100) / 100, // $14
          forecast?.occupancy_percent != null
            ? Math.round(forecast.occupancy_percent * 100) / 100
            : null, // $15
          demand?.demand_level ?? null, // $16
          demand?.booking_pace ?? null, // $17
          daysUntilArrival, // $18
          recommendation.primaryReason, // $19
          JSON.stringify(contributingFactors), // $20
          competitor?.avg_rate ?? null, // $21
          mktPosition, // $22
          competitor ? Math.round((competitor.max_rate - competitor.min_rate) * 100) / 100 : null, // $23
          Math.round(expectedRevenueImpact * 100) / 100, // $24
          Math.round(expectedOccImpact * 100) / 100, // $25
          Math.round(expectedRevparImpact * 100) / 100, // $26
          risk, // $27
          JSON.stringify({
            rate_change_magnitude: Math.abs(diffPercent) > 15 ? "large" : "moderate",
          }), // $28
          alt1, // $29
          Math.max(recommendation.confidence - 10, 30), // $30
          alt2, // $31
          Math.max(recommendation.confidence - 15, 25), // $32
          autoApply && recommendation.confidence >= autoApplyThreshold, // $33 auto_apply_eligible
          autoApplyThreshold, // $34
          MODEL_VERSION, // $35
          dataSources, // $36
          validUntil.toISOString(), // $37
          metadata ? JSON.stringify(metadata) : null, // $38
          actorId, // $39
        ],
      );

      const recId = insertedRows[0]?.recommendation_id;
      let wasAutoApplied = false;

      if (recId && autoApply && recommendation.confidence >= autoApplyThreshold) {
        await query(AUTO_APPLY_RECOMMENDATION_SQL, [recId, tenantId, actorId]);
        autoAppliedCount++;
        wasAutoApplied = true;
        logger.info(
          {
            recommendationId: recId,
            rate: recommendation.rate,
            confidence: recommendation.confidence,
          },
          "recommendation auto-applied",
        );
      }

      if (recId) {
        results.push({
          recommendation_id: recId,
          room_type_id: roomType.room_type_id,
          date: dateStr,
          current_rate: currentRate,
          recommended_rate: recommendation.rate,
          action,
          confidence: recommendation.confidence,
          auto_applied: wasAutoApplied,
        });
      }
    }
  }

  logger.info(
    { tenantId, propertyId, generated: results.length, autoApplied: autoAppliedCount },
    "rate recommendations generated",
  );

  return { generated: results.length, autoApplied: autoAppliedCount, results };
}

// ── Rate Computation Core ────────────────────────────

/**
 * Compute a recommended rate using a weighted multi-factor model.
 *
 * Factors:
 * - Occupancy signal (current vs forecast): weight 0.30
 * - Booking pace signal: weight 0.20
 * - Competitor positioning: weight 0.20
 * - Demand calendar signal: weight 0.15
 * - Lead time signal: weight 0.15
 */
function computeRecommendedRate(input: ComputeInput): ComputeResult {
  const factors: Array<{
    factor: string;
    weight: number;
    description: string;
    adjustment: number;
  }> = [];
  let totalWeight = 0;
  let weightedAdjustment = 0;
  let confidence = 50; // Base confidence
  let dataSignals = 0;

  // ── Factor 1: Occupancy Signal (weight 0.30) ──
  const occWeight = 0.3;
  const effectiveOcc = input.forecastOccPercent ?? input.occPercent;
  let occAdjustment = 0;
  let occDescription = "";

  if (effectiveOcc >= 90) {
    occAdjustment = 15; // High occupancy → raise rate substantially
    occDescription = `Occupancy ${input.forecastOccPercent != null ? "forecast" : "current"} at ${effectiveOcc.toFixed(0)}% — strong demand supports rate increase`;
  } else if (effectiveOcc >= 75) {
    occAdjustment = 8;
    occDescription = `Occupancy at ${effectiveOcc.toFixed(0)}% — moderate demand supports rate increase`;
  } else if (effectiveOcc >= 50) {
    occAdjustment = 0;
    occDescription = `Occupancy at ${effectiveOcc.toFixed(0)}% — balanced supply/demand`;
  } else if (effectiveOcc >= 30) {
    occAdjustment = -8;
    occDescription = `Occupancy at ${effectiveOcc.toFixed(0)}% — low demand suggests rate reduction`;
  } else {
    occAdjustment = -15;
    occDescription = `Occupancy at ${effectiveOcc.toFixed(0)}% — very low demand, reduce rate to stimulate bookings`;
  }

  factors.push({
    factor: "Occupancy Signal",
    weight: occWeight,
    description: occDescription,
    adjustment: occAdjustment,
  });
  weightedAdjustment += occAdjustment * occWeight;
  totalWeight += occWeight;
  if (input.forecastOccPercent != null) {
    confidence += 5; // Forecast data increases confidence
    dataSignals++;
  }
  if (input.occPercent > 0) dataSignals++;

  // ── Factor 2: Booking Pace Signal (weight 0.20) ──
  const paceWeight = 0.2;
  let paceAdjustment = 0;
  let paceDescription = "No booking pace data available";

  if (input.paceVsLastYear != null) {
    dataSignals++;
    confidence += 5;
    if (input.paceVsLastYear > 20) {
      paceAdjustment = 12;
      paceDescription = `Booking pace ${input.paceVsLastYear.toFixed(0)}% ahead of last year — strong pickup`;
    } else if (input.paceVsLastYear > 5) {
      paceAdjustment = 5;
      paceDescription = `Booking pace ${input.paceVsLastYear.toFixed(0)}% ahead of last year`;
    } else if (input.paceVsLastYear > -5) {
      paceAdjustment = 0;
      paceDescription = `Booking pace tracking with last year (${input.paceVsLastYear.toFixed(0)}%)`;
    } else if (input.paceVsLastYear > -20) {
      paceAdjustment = -5;
      paceDescription = `Booking pace ${Math.abs(input.paceVsLastYear).toFixed(0)}% behind last year`;
    } else {
      paceAdjustment = -12;
      paceDescription = `Booking pace ${Math.abs(input.paceVsLastYear).toFixed(0)}% behind last year — weak pickup`;
    }
  }

  factors.push({
    factor: "Booking Pace",
    weight: paceWeight,
    description: paceDescription,
    adjustment: paceAdjustment,
  });
  weightedAdjustment += paceAdjustment * paceWeight;
  totalWeight += paceWeight;

  // ── Factor 3: Competitor Positioning (weight 0.20) ──
  const compWeight = 0.2;
  let compAdjustment = 0;
  let compDescription = "No competitor rate data available";

  if (input.competitorAvg != null && input.competitorAvg > 0) {
    dataSignals++;
    confidence += 8;
    const diffFromComp = ((input.currentRate - input.competitorAvg) / input.competitorAvg) * 100;

    if (diffFromComp < -15) {
      compAdjustment = 10;
      compDescription = `Rate $${Math.abs(input.currentRate - input.competitorAvg).toFixed(0)} below competitor avg ($${input.competitorAvg.toFixed(0)}) — opportunity to increase`;
    } else if (diffFromComp < -5) {
      compAdjustment = 5;
      compDescription = `Slightly below competitor avg ($${input.competitorAvg.toFixed(0)})`;
    } else if (diffFromComp <= 5) {
      compAdjustment = 0;
      compDescription = `At market rate (competitor avg $${input.competitorAvg.toFixed(0)})`;
    } else if (diffFromComp <= 15) {
      compAdjustment = -3;
      compDescription = `Slightly above competitor avg ($${input.competitorAvg.toFixed(0)})`;
    } else {
      compAdjustment = -8;
      compDescription = `Rate $${(input.currentRate - input.competitorAvg).toFixed(0)} above competitor avg ($${input.competitorAvg.toFixed(0)}) — risk losing bookings`;
    }
  }

  factors.push({
    factor: "Competitor Rates",
    weight: compWeight,
    description: compDescription,
    adjustment: compAdjustment,
  });
  weightedAdjustment += compAdjustment * compWeight;
  totalWeight += compWeight;

  // ── Factor 4: Demand Calendar (weight 0.15) ──
  const demandWeight = 0.15;
  let demandAdjustment = 0;
  let demandDescription = "No demand calendar data";

  if (input.demandLevel) {
    dataSignals++;
    confidence += 5;
    switch (input.demandLevel) {
      case "BLACKOUT":
      case "PEAK":
        demandAdjustment = 15;
        demandDescription = `${input.demandLevel} demand period — maximize rate`;
        break;
      case "HIGH":
        demandAdjustment = 8;
        demandDescription = "High demand period — increase rate";
        break;
      case "MODERATE":
        demandAdjustment = 0;
        demandDescription = "Moderate demand — maintain current approach";
        break;
      case "LOW":
        demandAdjustment = -10;
        demandDescription = "Low demand period — reduce rate to drive volume";
        break;
    }
  }

  factors.push({
    factor: "Demand Calendar",
    weight: demandWeight,
    description: demandDescription,
    adjustment: demandAdjustment,
  });
  weightedAdjustment += demandAdjustment * demandWeight;
  totalWeight += demandWeight;

  // ── Factor 5: Lead Time Signal (weight 0.15) ──
  const leadWeight = 0.15;
  let leadAdjustment = 0;
  let leadDescription: string;

  if (input.daysUntilArrival <= 1) {
    leadAdjustment = -5;
    leadDescription = "Same-day/tomorrow — last chance to sell, slight discount";
  } else if (input.daysUntilArrival <= 3) {
    leadAdjustment = effectiveOcc > 70 ? 10 : -3;
    leadDescription =
      effectiveOcc > 70
        ? "Short lead time with high occupancy — premium pricing"
        : "Short lead time with availability — stimulate last-minute bookings";
  } else if (input.daysUntilArrival <= 14) {
    leadAdjustment = 3;
    leadDescription = "Tactical window (1-2 weeks) — optimize rate based on pickup";
  } else if (input.daysUntilArrival <= 30) {
    leadAdjustment = 0;
    leadDescription = "Operational window (2-4 weeks) — standard pricing";
  } else {
    leadAdjustment = -2;
    leadDescription = "Strategic window (30+ days) — early bird potential";
  }

  factors.push({
    factor: "Lead Time",
    weight: leadWeight,
    description: leadDescription,
    adjustment: leadAdjustment,
  });
  weightedAdjustment += leadAdjustment * leadWeight;
  totalWeight += leadWeight;

  // ── Compute Final Rate ─────────────────
  const adjustmentPercent = totalWeight > 0 ? weightedAdjustment / totalWeight : 0;
  let recommendedRate = input.currentRate * (1 + adjustmentPercent / 100);

  // Apply pricing rule floor/ceiling
  recommendedRate = Math.max(recommendedRate, input.minRate);
  recommendedRate = Math.min(recommendedRate, input.maxRate);

  // Round to nearest cent
  recommendedRate = Math.round(recommendedRate * 100) / 100;

  // ── Confidence Adjustment ──────────────
  // More data signals → higher confidence
  confidence += dataSignals * 3;
  // Very small adjustments have lower confidence (noise)
  const absDiffPercent = Math.abs(
    ((recommendedRate - input.currentRate) / input.currentRate) * 100,
  );
  if (absDiffPercent < 2) confidence -= 10;
  // Clamp 0-100
  confidence = Math.max(0, Math.min(100, confidence));

  // ── Primary Reason ─────────────────────
  // Pick the factor with the largest absolute adjustment
  const sortedFactors = [...factors].sort(
    (a, b) => Math.abs(b.adjustment * b.weight) - Math.abs(a.adjustment * a.weight),
  );
  const primaryReason = sortedFactors[0]?.description ?? "Multi-factor analysis";

  return {
    rate: recommendedRate,
    confidence,
    primaryReason,
    factors: factors.map(({ factor, weight, description }) => ({ factor, weight, description })),
  };
}
