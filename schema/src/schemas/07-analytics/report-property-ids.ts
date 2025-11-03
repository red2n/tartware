/**
 * ReportPropertyIds Schema
 * @table report_property_ids
 * @category 07-analytics
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid } from '../../shared/base-schemas.js';

/**
 * Complete ReportPropertyIds schema
 */
export const ReportPropertyIdsSchema = z.object({
  id: uuid,
  report_id: uuid,
  property_id: uuid,
  tenant_id: uuid,
  created_at: z.coerce.date(),
});

export type ReportPropertyIds = z.infer<typeof ReportPropertyIdsSchema>;

/**
 * Schema for creating a new report property ids
 */
export const CreateReportPropertyIdsSchema = ReportPropertyIdsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateReportPropertyIds = z.infer<typeof CreateReportPropertyIdsSchema>;

/**
 * Schema for updating a report property ids
 */
export const UpdateReportPropertyIdsSchema = ReportPropertyIdsSchema.partial();

export type UpdateReportPropertyIds = z.infer<typeof UpdateReportPropertyIdsSchema>;
