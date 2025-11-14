/**
 * UserTenantAssociations Schema
 * @table user_tenant_associations
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid
} from '../../shared/base-schemas.js';
import { TenantRoleEnum } from '../../shared/enums.js';

/**
 * Complete UserTenantAssociations schema
 */
export const UserTenantAssociationsSchema = z.object({
  id: uuid,
  user_id: uuid,
  tenant_id: uuid,
  role: TenantRoleEnum,
  is_active: z.boolean(),
  permissions: z.record(z.unknown()).optional(),
  valid_from: z.coerce.date().optional(),
  valid_until: z.coerce.date().optional(),
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

export type UserTenantAssociations = z.infer<typeof UserTenantAssociationsSchema>;

/**
 * Schema for creating a new user tenant associations
 */
export const CreateUserTenantAssociationsSchema = UserTenantAssociationsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateUserTenantAssociations = z.infer<typeof CreateUserTenantAssociationsSchema>;

/**
 * Schema for updating a user tenant associations
 */
export const UpdateUserTenantAssociationsSchema = UserTenantAssociationsSchema.partial();

export type UpdateUserTenantAssociations = z.infer<typeof UpdateUserTenantAssociationsSchema>;
