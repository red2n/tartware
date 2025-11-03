/**
 * AiDemandPredictions Schema
 * @table ai_demand_predictions
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete AiDemandPredictions schema
 */
export const AiDemandPredictionsSchema = z.object({
  prediction_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  prediction_date: z.coerce.date(),
  room_type_id: uuid.optional(),
  all_room_types: z.boolean().optional(),
  days_ahead: z.number().int(),
  predicted_at: z.coerce.date().optional(),
  predicted_demand: money,
  predicted_rooms_sold: z.number().int().optional(),
  predicted_rooms_available: z.number().int().optional(),
  confidence_level: money.optional(),
  confidence_interval_lower: money.optional(),
  confidence_interval_upper: money.optional(),
  predicted_demand_transient: money.optional(),
  predicted_demand_corporate: money.optional(),
  predicted_demand_group: money.optional(),
  predicted_demand_leisure: money.optional(),
  predicted_direct_bookings: z.number().int().optional(),
  predicted_ota_bookings: z.number().int().optional(),
  predicted_phone_bookings: z.number().int().optional(),
  predicted_walkin_bookings: z.number().int().optional(),
  predicted_adr: money.optional(),
  predicted_revpar: money.optional(),
  predicted_total_revenue: money.optional(),
  optimal_base_rate: money.optional(),
  optimal_rate_min: money.optional(),
  optimal_rate_max: money.optional(),
  day_of_week: z.string().optional(),
  is_weekend: z.boolean().optional(),
  is_holiday: z.boolean().optional(),
  local_events: z.array(z.string()).optional(),
  event_impact_score: money.optional(),
  season: z.string().optional(),
  weather_forecast: z.string().optional(),
  temperature_forecast: money.optional(),
  competitor_avg_price: money.optional(),
  competitor_occupancy: money.optional(),
  market_demand_index: money.optional(),
  historical_occupancy_same_dow: money.optional(),
  historical_occupancy_last_year: money.optional(),
  historical_occupancy_last_month: money.optional(),
  booking_pace: money.optional(),
  pickup_rate: money.optional(),
  flight_capacity_index: money.optional(),
  search_volume_index: money.optional(),
  social_media_sentiment: money.optional(),
  economic_indicator: money.optional(),
  model_name: z.string(),
  model_version: z.string().optional(),
  model_type: z.string().optional(),
  feature_importance: z.record(z.unknown()).optional(),
  training_data_period_start: z.coerce.date().optional(),
  training_data_period_end: z.coerce.date().optional(),
  training_accuracy: money.optional(),
  actual_occupancy: money.optional(),
  actual_rooms_sold: z.number().int().optional(),
  actual_adr: money.optional(),
  actual_revpar: money.optional(),
  actual_total_revenue: money.optional(),
  occupancy_error: money.optional(),
  revenue_error: money.optional(),
  is_accurate: z.boolean().optional(),
  pricing_action_taken: z.string().optional(),
  rate_adjustment_amount: money.optional(),
  action_notes: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type AiDemandPredictions = z.infer<typeof AiDemandPredictionsSchema>;

/**
 * Schema for creating a new ai demand predictions
 */
export const CreateAiDemandPredictionsSchema = AiDemandPredictionsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateAiDemandPredictions = z.infer<typeof CreateAiDemandPredictionsSchema>;

/**
 * Schema for updating a ai demand predictions
 */
export const UpdateAiDemandPredictionsSchema = AiDemandPredictionsSchema.partial();

export type UpdateAiDemandPredictions = z.infer<typeof UpdateAiDemandPredictionsSchema>;
