/**
 * Properties Schema
 * @table properties
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete Properties schema
 */
export const PropertiesSchema = z.object({
  id: uuid,
  tenant_id: uuid,
  property_name: z.string(),
  property_code: z.string(),
  address: z.record(z.unknown()),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  property_type: z.string().optional(),
  star_rating: money.optional(),
  total_rooms: z.number().int(),
  tax_id: z.string().optional(),
  license_number: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  integrations: z.record(z.unknown()).optional(),
  is_active: z.boolean(),
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

export type Properties = z.infer<typeof PropertiesSchema>;

/**
 * Schema for creating a new properties
 */
export const CreatePropertiesSchema = PropertiesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateProperties = z.infer<typeof CreatePropertiesSchema>;

/**
 * Schema for updating a properties
 */
export const UpdatePropertiesSchema = PropertiesSchema.partial();

export type UpdateProperties = z.infer<typeof UpdatePropertiesSchema>;
