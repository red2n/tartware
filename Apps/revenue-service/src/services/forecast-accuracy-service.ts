import type { ForecastAccuracyItem, ForecastAccuracyRow } from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toNumber } from "../lib/row-mappers.js";
import {
    FORECAST_ACCURACY_LIST_SQL,
    FORECAST_ADJUST_SQL,
    FORECAST_EVALUATE_SQL,
} from "../sql/forecast-queries.js";

// ============================================================================
// FORECAST ACCURACY TRACKING (R13)
// ============================================================================

const mapRowToAccuracyItem = (row: ForecastAccuracyRow): ForecastAccuracyItem => ({
    forecast_id: row.forecast_id,
    forecast_date: toDateString(row.forecast_date) ?? "",
    period_start: toDateString(row.period_start_date) ?? "",
    period_end: toDateString(row.period_end_date) ?? "",
    forecast_scenario: row.forecast_scenario,
    forecasted_occupancy:
        row.forecasted_occupancy_percent != null ? toNumber(row.forecasted_occupancy_percent) : null,
    forecasted_adr: row.forecasted_adr != null ? toNumber(row.forecasted_adr) : null,
    forecasted_revpar: row.forecasted_revpar != null ? toNumber(row.forecasted_revpar) : null,
    forecasted_room_revenue:
        row.room_revenue_forecast != null ? toNumber(row.room_revenue_forecast) : null,
    actual_occupancy: row.actual_occupancy != null ? toNumber(row.actual_occupancy) : null,
    actual_adr: row.actual_adr != null ? toNumber(row.actual_adr) : null,
    actual_revpar: row.actual_revpar != null ? toNumber(row.actual_revpar) : null,
    actual_room_revenue: row.actual_room_revenue != null ? toNumber(row.actual_room_revenue) : null,
    variance_percent: row.variance_percent != null ? toNumber(row.variance_percent) : null,
    accuracy_score: row.accuracy_score != null ? toNumber(row.accuracy_score) : null,
});

/**
 * Evaluate forecast accuracy for a business date.
 * Compares forecasted values vs actual reservation data and updates
 * the revenue_forecasts table with variance and accuracy scores.
 */
export const evaluateForecastAccuracy = async (opts: {
    tenantId: string;
    propertyId: string;
    businessDate: string;
    actorId: string;
}): Promise<{ evaluated: boolean }> => {
    await query(FORECAST_EVALUATE_SQL, [
        opts.tenantId,
        opts.propertyId,
        opts.businessDate,
        opts.actorId,
    ]);
    return { evaluated: true };
};

/**
 * Get forecast accuracy report for a date range.
 * Returns forecasts that have been evaluated with actual data,
 * plus summary MAPE/bias metrics.
 */
export const getForecastAccuracyReport = async (opts: {
    tenantId: string;
    propertyId: string;
    startDate: string;
    endDate: string;
    forecastScenario?: string;
}): Promise<{
    period_start: string;
    period_end: string;
    total_evaluated: number;
    mape: number | null;
    bias: number | null;
    avg_accuracy_score: number | null;
    items: ForecastAccuracyItem[];
}> => {
    const { rows } = await query<ForecastAccuracyRow>(FORECAST_ACCURACY_LIST_SQL, [
        opts.tenantId,
        opts.propertyId,
        opts.startDate,
        opts.endDate,
        opts.forecastScenario ?? null,
    ]);

    const items = rows.map(mapRowToAccuracyItem);

    // Compute MAPE and bias from variance_percent values
    const withVariance = items.filter((i) => i.variance_percent != null);
    const n = withVariance.length;

    const mape =
        n > 0
            ? Math.round(
                (withVariance.reduce((sum, i) => sum + Math.abs(i.variance_percent ?? 0), 0) / n) * 100,
            ) / 100
            : null;

    const bias =
        n > 0
            ? Math.round(
                (withVariance.reduce((sum, i) => sum + (i.variance_percent ?? 0), 0) / n) * 100,
            ) / 100
            : null;

    const withAccuracy = items.filter((i) => i.accuracy_score != null);
    const avgAccuracy =
        withAccuracy.length > 0
            ? Math.round(
                (withAccuracy.reduce((sum, i) => sum + (i.accuracy_score ?? 0), 0) /
                    withAccuracy.length) *
                100,
            ) / 100
            : null;

    return {
        period_start: opts.startDate,
        period_end: opts.endDate,
        total_evaluated: items.length,
        mape,
        bias,
        avg_accuracy_score: avgAccuracy,
        items,
    };
};

// ============================================================================
// FORECAST ADJUSTMENT (R12)
// ============================================================================

/**
 * Apply a manual adjustment to a forecast.
 * Revenue managers use this to override the system's forecast when they
 * have information the algorithm hasn't seen (events, group blocks, etc.).
 */
export const adjustForecast = async (opts: {
    tenantId: string;
    propertyId: string;
    forecastDate: string;
    forecastPeriod: string;
    forecastScenario: string;
    occupancyPercent?: number;
    adr?: number;
    roomRevenue?: number;
    reason: string;
    actorId: string;
}): Promise<{ adjusted: boolean }> => {
    await query(FORECAST_ADJUST_SQL, [
        opts.tenantId,
        opts.propertyId,
        opts.forecastDate,
        opts.forecastPeriod,
        opts.forecastScenario,
        opts.occupancyPercent ?? null,
        opts.adr ?? null,
        opts.roomRevenue ?? null,
        opts.reason,
        opts.actorId,
    ]);
    return { adjusted: true };
};
