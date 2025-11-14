/**
 * RateRecommendations Schema
 * @table rate_recommendations
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete RateRecommendations schema
 */
export const RateRecommendationsSchema = z.object({
  recommendation_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  recommendation_date: z.coerce.date(),
  room_type_id: uuid,
  rate_plan_id: uuid.optional(),
  current_rate: money,
  recommended_rate: money,
  rate_difference: money,
  rate_difference_percent: money,
  recommendation_action: z.string(),
  urgency: z.string().optional(),
  confidence_score: money,
  confidence_level: z.string().optional(),
  recommendation_quality: z.string().optional(),
  current_occupancy_percent: money.optional(),
  forecasted_occupancy_percent: money.optional(),
  current_demand_level: z.string().optional(),
  booking_pace: z.string().optional(),
  days_until_arrival: z.number().int().optional(),
  primary_reason: z.string(),
  contributing_factors: z.record(z.unknown()).optional(),
  competitor_average_rate: money.optional(),
  market_position: z.string().optional(),
  competitor_rate_spread: money.optional(),
  model_version: z.string().optional(),
  model_algorithm: z.string().optional(),
  model_training_date: z.coerce.date().optional(),
  model_accuracy_score: money.optional(),
  data_sources_used: z.array(z.string()).optional(),
  data_quality_score: money.optional(),
  data_freshness_hours: z.number().int().optional(),
  expected_revenue_impact: money.optional(),
  expected_occupancy_impact: money.optional(),
  expected_bookings_impact: z.number().int().optional(),
  expected_revpar_impact: money.optional(),
  risk_level: z.string().optional(),
  risk_factors: z.record(z.unknown()).optional(),
  downside_risk: money.optional(),
  upside_potential: money.optional(),
  alternative_rate_1: money.optional(),
  alternative_rate_1_confidence: money.optional(),
  alternative_rate_2: money.optional(),
  alternative_rate_2_confidence: money.optional(),
  status: z.string().optional(),
  reviewed_by: uuid.optional(),
  reviewed_at: z.coerce.date().optional(),
  review_notes: z.string().optional(),
  accepted: z.boolean().optional(),
  accepted_by: uuid.optional(),
  accepted_at: z.coerce.date().optional(),
  acceptance_method: z.string().optional(),
  rejected: z.boolean().optional(),
  rejected_by: uuid.optional(),
  rejected_at: z.coerce.date().optional(),
  rejection_reason: z.string().optional(),
  implemented: z.boolean().optional(),
  implemented_rate: money.optional(),
  implemented_at: z.coerce.date().optional(),
  implemented_by: uuid.optional(),
  implementation_notes: z.string().optional(),
  actual_rate_applied: money.optional(),
  actual_occupancy_percent: money.optional(),
  actual_revenue: money.optional(),
  actual_bookings: z.number().int().optional(),
  recommendation_accuracy: money.optional(),
  revenue_variance: money.optional(),
  occupancy_variance: money.optional(),
  was_recommendation_effective: z.boolean().optional(),
  effectiveness_score: money.optional(),
  feedback_provided: z.boolean().optional(),
  feedback_rating: z.number().int().optional(),
  feedback_comments: z.string().optional(),
  feedback_by: uuid.optional(),
  feedback_at: z.coerce.date().optional(),
  valid_until: z.coerce.date().optional(),
  is_expired: z.boolean().optional(),
  superseded_by: uuid.optional(),
  auto_apply_eligible: z.boolean().optional(),
  auto_applied: z.boolean().optional(),
  auto_apply_threshold: money.optional(),
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

export type RateRecommendations = z.infer<typeof RateRecommendationsSchema>;

/**
 * Schema for creating a new rate recommendations
 */
export const CreateRateRecommendationsSchema = RateRecommendationsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateRateRecommendations = z.infer<typeof CreateRateRecommendationsSchema>;

/**
 * Schema for updating a rate recommendations
 */
export const UpdateRateRecommendationsSchema = RateRecommendationsSchema.partial();

export type UpdateRateRecommendations = z.infer<typeof UpdateRateRecommendationsSchema>;
