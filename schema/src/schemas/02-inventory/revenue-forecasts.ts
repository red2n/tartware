/**
 * RevenueForecasts Schema
 * @table revenue_forecasts
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete RevenueForecasts schema
 */
export const RevenueForecastsSchema = z.object({
  forecast_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  forecast_date: z.coerce.date(),
  forecast_period: z.string(),
  period_start_date: z.coerce.date(),
  period_end_date: z.coerce.date(),
  forecast_type: z.string(),
  forecast_scenario: z.string().optional(),
  forecasted_value: money,
  confidence_level: money.optional(),
  confidence_interval_low: money.optional(),
  confidence_interval_high: money.optional(),
  actual_value: money.optional(),
  variance: money.optional(),
  variance_percent: money.optional(),
  accuracy_score: money.optional(),
  room_revenue_forecast: money.optional(),
  fb_revenue_forecast: money.optional(),
  other_revenue_forecast: money.optional(),
  total_revenue_forecast: money.optional(),
  forecasted_occupancy_percent: money.optional(),
  forecasted_adr: money.optional(),
  forecasted_revpar: money.optional(),
  forecasted_rooms_sold: z.number().int().optional(),
  forecasted_room_nights: z.number().int().optional(),
  model_version: z.string().optional(),
  model_algorithm: z.string().optional(),
  model_accuracy: money.optional(),
  training_data_period_days: z.number().int().optional(),
  factors_included: z.record(z.unknown()).optional(),
  historical_data_points: z.number().int().optional(),
  external_factors: z.record(z.unknown()).optional(),
  market_demand: z.string().optional(),
  market_segment_breakdown: z.record(z.unknown()).optional(),
  channel_distribution_forecast: z.record(z.unknown()).optional(),
  events_considered: z.record(z.unknown()).optional(),
  events_impact_adjustment: money.optional(),
  is_peak_season: z.boolean().optional(),
  is_shoulder_season: z.boolean().optional(),
  is_low_season: z.boolean().optional(),
  seasonality_factor: money.optional(),
  manual_adjustment: money.optional(),
  manual_adjustment_reason: z.string().optional(),
  adjusted_by: uuid.optional(),
  adjusted_at: z.coerce.date().optional(),
  review_status: z.string().optional(),
  reviewed_by: uuid.optional(),
  reviewed_at: z.coerce.date().optional(),
  review_notes: z.string().optional(),
  alert_if_variance_exceeds_percent: money.optional(),
  alert_triggered: z.boolean().optional(),
  alert_sent_at: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type RevenueForecasts = z.infer<typeof RevenueForecastsSchema>;

/**
 * Schema for creating a new revenue forecasts
 */
export const CreateRevenueForecastsSchema = RevenueForecastsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateRevenueForecasts = z.infer<typeof CreateRevenueForecastsSchema>;

/**
 * Schema for updating a revenue forecasts
 */
export const UpdateRevenueForecastsSchema = RevenueForecastsSchema.partial();

export type UpdateRevenueForecasts = z.infer<typeof UpdateRevenueForecastsSchema>;
