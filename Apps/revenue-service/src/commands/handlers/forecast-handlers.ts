import type { CommandMetadata } from "@tartware/command-consumer-utils";
import { snapshotBookingPace } from "../../services/booking-pace-service.js";
import {
  adjustForecast,
  evaluateForecastAccuracy,
} from "../../services/forecast-accuracy-service.js";
import { computeForecasts } from "../../services/forecast-engine.js";

/** Resolves the actor ID from command metadata. */
export const resolveActorId = (initiatedBy: CommandMetadata["initiatedBy"]): string | null =>
  typeof initiatedBy === "string" ? initiatedBy : (initiatedBy?.userId ?? null);

export const handleForecastCompute = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<void> => {
  const p = payload as {
    property_id: string;
    forecast_period?: "daily" | "weekly" | "monthly";
    horizon_days?: number;
    training_days?: number;
    scenarios?: string[];
  };
  await computeForecasts({
    tenantId: metadata.tenantId,
    propertyId: p.property_id,
    forecastPeriod: p.forecast_period ?? "daily",
    horizonDays: p.horizon_days ?? 30,
    trainingDays: p.training_days ?? 90,
    scenarios: p.scenarios ?? ["base", "optimistic", "pessimistic"],
    actorId: actorId ?? "system",
  });
};

/** R11: Snapshot booking pace into demand_calendar for future dates. */
export const handleBookingPaceSnapshot = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ daysUpdated: number }> => {
  const p = payload as { property_id: string; horizon_days?: number };
  return snapshotBookingPace({
    tenantId: metadata.tenantId,
    propertyId: p.property_id,
    horizonDays: p.horizon_days ?? 90,
    actorId: actorId ?? "system",
  });
};

/** R12: Manual forecast adjustment by revenue manager. */
export const handleForecastAdjust = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ adjusted: boolean }> => {
  const p = payload as {
    property_id: string;
    forecast_date: string;
    forecast_period?: string;
    forecast_scenario?: string;
    adjustments: { occupancy_percent?: number; adr?: number; room_revenue?: number };
    reason: string;
  };
  return adjustForecast({
    tenantId: metadata.tenantId,
    propertyId: p.property_id,
    forecastDate: p.forecast_date,
    forecastPeriod: p.forecast_period ?? "daily",
    forecastScenario: p.forecast_scenario ?? "base",
    occupancyPercent: p.adjustments.occupancy_percent,
    adr: p.adjustments.adr,
    roomRevenue: p.adjustments.room_revenue,
    reason: p.reason,
    actorId: actorId ?? "system",
  });
};

/** R13: Evaluate forecast accuracy for a past business date. */
export const handleForecastEvaluate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ evaluated: boolean }> => {
  const p = payload as { property_id: string; business_date: string };
  return evaluateForecastAccuracy({
    tenantId: metadata.tenantId,
    propertyId: p.property_id,
    businessDate: p.business_date,
    actorId: actorId ?? "system",
  });
};
