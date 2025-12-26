/**
 * PropertySettings Schema
 * @table property_settings
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid
} from '../../shared/base-schemas.js';

/**
 * Complete PropertySettings schema
 */
export const PropertySettingsSchema = z.object({
  property_setting_id: uuid,
  property_id: uuid,
  setting_id: uuid,
  value: z.record(z.unknown()),
  effective_from: z.coerce.date().optional(),
  effective_to: z.coerce.date().optional(),
  notes: z.string().optional(),
  documentation: z.string().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
});

export type PropertySettings = z.infer<typeof PropertySettingsSchema>;

/**
 * Schema for creating a new property settings
 */
export const CreatePropertySettingsSchema = PropertySettingsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreatePropertySettings = z.infer<typeof CreatePropertySettingsSchema>;

/**
 * Schema for updating a property settings
 */
export const UpdatePropertySettingsSchema = PropertySettingsSchema.partial();

export type UpdatePropertySettings = z.infer<typeof UpdatePropertySettingsSchema>;
