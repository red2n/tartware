/**
 * RevenueGoals Schema
 * @table revenue_goals
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete RevenueGoals schema
 */
export const RevenueGoalsSchema = z.object({
  goal_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  goal_period: z.string(),
  period_start_date: z.coerce.date(),
  period_end_date: z.coerce.date(),
  fiscal_year: z.number().int().optional(),
  fiscal_quarter: z.number().int().optional(),
  goal_type: z.string(),
  goal_category: z.string().optional(),
  goal_amount: money.optional(),
  goal_percent: money.optional(),
  goal_count: z.number().int().optional(),
  currency: z.string().optional(),
  baseline_amount: money.optional(),
  baseline_source: z.string().optional(),
  growth_target_percent: money.optional(),
  room_revenue_goal: money.optional(),
  fb_revenue_goal: money.optional(),
  other_revenue_goal: money.optional(),
  occupancy_goal_percent: money.optional(),
  adr_goal: money.optional(),
  revpar_goal: money.optional(),
  segment_goals: z.record(z.unknown()).optional(),
  channel_goals: z.record(z.unknown()).optional(),
  room_type_goals: z.record(z.unknown()).optional(),
  actual_amount: money.optional(),
  actual_percent: money.optional(),
  actual_count: z.number().int().optional(),
  variance_amount: money.optional(),
  variance_percent: money.optional(),
  variance_status: z.string().optional(),
  progress_percent: money.optional(),
  days_elapsed: z.number().int().optional(),
  days_remaining: z.number().int().optional(),
  expected_progress_percent: money.optional(),
  pace: z.string().optional(),
  is_achieved: z.boolean().optional(),
  achievement_date: z.coerce.date().optional(),
  achievement_percent: money.optional(),
  over_achievement_amount: money.optional(),
  forecasted_amount: money.optional(),
  forecast_variance: money.optional(),
  forecast_confidence: money.optional(),
  likely_to_achieve: z.boolean().optional(),
  daily_run_rate_required: money.optional(),
  daily_run_rate_actual: money.optional(),
  cumulative_actual: money.optional(),
  cumulative_goal_to_date: money.optional(),
  milestones: z.record(z.unknown()).optional(),
  next_milestone_date: z.coerce.date().optional(),
  next_milestone_target: money.optional(),
  alert_if_behind_by_percent: money.optional(),
  alert_threshold_reached: z.boolean().optional(),
  alert_sent: z.boolean().optional(),
  alert_sent_at: z.coerce.date().optional(),
  alert_recipients: z.array(uuid).optional(),
  action_plan_required: z.boolean().optional(),
  action_plan: z.string().optional(),
  action_plan_owner: uuid.optional(),
  action_plan_due_date: z.coerce.date().optional(),
  corrective_actions: z.record(z.unknown()).optional(),
  external_factors_impact: z.record(z.unknown()).optional(),
  market_conditions: z.string().optional(),
  events_impact: z.record(z.unknown()).optional(),
  responsible_user_id: uuid.optional(),
  responsible_team: z.string().optional(),
  department: z.string().optional(),
  has_incentive_attached: z.boolean().optional(),
  incentive_structure: z.record(z.unknown()).optional(),
  incentive_amount: money.optional(),
  incentive_paid: z.boolean().optional(),
  same_period_last_year_actual: money.optional(),
  same_period_last_year_goal: money.optional(),
  yoy_growth_actual_percent: money.optional(),
  yoy_growth_goal_percent: money.optional(),
  status: z.string().optional(),
  approved_by: uuid.optional(),
  approved_at: z.coerce.date().optional(),
  approval_notes: z.string().optional(),
  is_revised: z.boolean().optional(),
  original_goal_id: uuid.optional(),
  revision_number: z.number().int().optional(),
  revision_reason: z.string().optional(),
  revised_by: uuid.optional(),
  revised_at: z.coerce.date().optional(),
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

export type RevenueGoals = z.infer<typeof RevenueGoalsSchema>;

/**
 * Schema for creating a new revenue goals
 */
export const CreateRevenueGoalsSchema = RevenueGoalsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateRevenueGoals = z.infer<typeof CreateRevenueGoalsSchema>;

/**
 * Schema for updating a revenue goals
 */
export const UpdateRevenueGoalsSchema = RevenueGoalsSchema.partial();

export type UpdateRevenueGoals = z.infer<typeof UpdateRevenueGoalsSchema>;
