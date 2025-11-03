/**
 * PerformanceBaselines Schema
 * @table performance_baselines
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete PerformanceBaselines schema
 */
export const PerformanceBaselinesSchema = z.object({
  baseline_id: uuid,
  metric_name: z.string(),
  time_window: z.string(),
  baseline_value: money,
  stddev_value: money.optional(),
  min_value: money.optional(),
  max_value: money.optional(),
  sample_count: z.number().int().optional(),
  last_updated: z.coerce.date().optional(),
  created_at: z.coerce.date().optional(),
});

export type PerformanceBaselines = z.infer<typeof PerformanceBaselinesSchema>;

/**
 * Schema for creating a new performance baselines
 */
export const CreatePerformanceBaselinesSchema = PerformanceBaselinesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreatePerformanceBaselines = z.infer<typeof CreatePerformanceBaselinesSchema>;

/**
 * Schema for updating a performance baselines
 */
export const UpdatePerformanceBaselinesSchema = PerformanceBaselinesSchema.partial();

export type UpdatePerformanceBaselines = z.infer<typeof UpdatePerformanceBaselinesSchema>;
