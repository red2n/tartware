/**
 * TenantSettings Schema
 * @table tenant_settings
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid
} from '../../shared/base-schemas.js';

/**
 * Complete TenantSettings schema
 */
export const TenantSettingsSchema = z.object({
  tenant_setting_id: uuid,
  tenant_id: uuid,
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

export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

/**
 * Schema for creating a new tenant settings
 */
export const CreateTenantSettingsSchema = TenantSettingsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateTenantSettings = z.infer<typeof CreateTenantSettingsSchema>;

/**
 * Schema for updating a tenant settings
 */
export const UpdateTenantSettingsSchema = TenantSettingsSchema.partial();

export type UpdateTenantSettings = z.infer<typeof UpdateTenantSettingsSchema>;
