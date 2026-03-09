import type { CommandMetadata } from "@tartware/command-consumer-utils";

import { query } from "../../lib/db.js";
import { computeForecasts } from "../../services/forecast-engine.js";
import { REVENUE_GOAL_TRACK_ACTUAL_SQL } from "../../sql/goal-queries.js";

/** SQL to find all active goals covering a given business date. */
const ACTIVE_GOALS_FOR_DATE_SQL = `
  SELECT goal_id
  FROM public.revenue_goals
  WHERE tenant_id = $1::uuid
    AND property_id = $2::uuid
    AND period_start_date <= $3::date
    AND period_end_date >= $3::date
    AND COALESCE(is_deleted, false) = false
    AND status NOT IN ('cancelled', 'rejected')
`;

/**
 * End-of-day revenue processing triggered after night audit.
 *
 * 1. Snapshot actual performance for all active goals covering the business date.
 * 2. Re-compute forecasts for the property (unless skip_forecast is set).
 */
export const handleDailyCloseProcess = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ goalsUpdated: number; forecastRun: boolean }> => {
  const propertyId = payload.property_id as string;
  const businessDate = payload.business_date as string;
  const skipForecast = (payload.skip_forecast as boolean) ?? false;
  const skipGoalTracking = (payload.skip_goal_tracking as boolean) ?? false;

  let goalsUpdated = 0;

  // Step 1: Track actuals for all active goals covering this business date
  if (!skipGoalTracking) {
    const { rows: goals } = await query<{ goal_id: string }>(ACTIVE_GOALS_FOR_DATE_SQL, [
      metadata.tenantId,
      propertyId,
      businessDate,
    ]);

    for (const goal of goals) {
      await query(REVENUE_GOAL_TRACK_ACTUAL_SQL, [
        goal.goal_id,
        metadata.tenantId,
        actorId ?? metadata.tenantId,
      ]);
      goalsUpdated++;
    }
  }

  // Step 2: Re-compute forecasts for the property
  let forecastRun = false;
  if (!skipForecast) {
    await computeForecasts({
      tenantId: metadata.tenantId,
      propertyId,
      forecastPeriod: "daily",
      horizonDays: 30,
      trainingDays: 90,
      scenarios: ["base", "optimistic", "pessimistic"],
      actorId: actorId ?? "system",
    });
    forecastRun = true;
  }

  return { goalsUpdated, forecastRun };
};
