import type { CommandMetadata } from "@tartware/command-consumer-utils";
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
