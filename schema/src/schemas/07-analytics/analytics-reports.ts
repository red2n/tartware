/**
 * AnalyticsReports Schema
 * @table analytics_reports
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid } from '../../shared/base-schemas.js';

/**
 * Complete AnalyticsReports schema
 */
export const AnalyticsReportsSchema = z.object({
  id: uuid,
  tenant_id: uuid,
  report_name: z.string(),
  report_code: z.string(),
  report_type: z.string(),
  description: z.string().optional(),
  definition: z.record(z.unknown()),
  visualization_type: z.string().optional(),
  visualization_config: z.record(z.unknown()).optional(),
  is_scheduled: z.boolean().optional(),
  schedule_config: z.record(z.unknown()).optional(),
  last_run_at: z.coerce.date().optional(),
  next_run_at: z.coerce.date().optional(),
  is_public: z.boolean().optional(),
  created_by_user_id: uuid,
  shared_with: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: z.string().optional(),
  version: z.bigint().optional(),
});

export type AnalyticsReports = z.infer<typeof AnalyticsReportsSchema>;

/**
 * Schema for creating a new analytics reports
 */
export const CreateAnalyticsReportsSchema = AnalyticsReportsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateAnalyticsReports = z.infer<typeof CreateAnalyticsReportsSchema>;

/**
 * Schema for updating a analytics reports
 */
export const UpdateAnalyticsReportsSchema = AnalyticsReportsSchema.partial();

export type UpdateAnalyticsReports = z.infer<typeof UpdateAnalyticsReportsSchema>;
