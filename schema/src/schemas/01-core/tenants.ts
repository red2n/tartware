/**
 * Tenants Schema
 * @table tenants
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid
} from '../../shared/base-schemas.js';
import { TenantTypeEnum, TenantStatusEnum } from '../../shared/enums.js';

/**
 * Complete Tenants schema
 */
export const TenantsSchema = z.object({
  id: uuid,
  name: z.string(),
  slug: z.string(),
  type: TenantTypeEnum,
  status: TenantStatusEnum,
  email: z.string(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  tax_id: z.string().optional(),
  business_license: z.string().optional(),
  registration_number: z.string().optional(),
  config: z.record(z.unknown()),
  subscription: z.record(z.unknown()),
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

export type Tenants = z.infer<typeof TenantsSchema>;

/**
 * Schema for creating a new tenants
 */
export const CreateTenantsSchema = TenantsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateTenants = z.infer<typeof CreateTenantsSchema>;

/**
 * Schema for updating a tenants
 */
export const UpdateTenantsSchema = TenantsSchema.partial();

export type UpdateTenants = z.infer<typeof UpdateTenantsSchema>;
