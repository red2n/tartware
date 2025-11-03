/**
 * User-Tenant Association Schema - RBAC relationship
 * @table user_tenant_associations
 * @category 01-core
 * @synchronized 2025-11-03
 */

import { z } from 'zod';

import {
  uuid,
  tenantId as tenantIdBase,
  auditTimestamps,
  softDelete,
  jsonbMetadata,
} from '../../shared/base-schemas.js';
import { TenantRoleEnum } from '../../shared/enums.js';
import { validateDateRange } from '../../shared/validators.js';

/**
 * Permissions JSONB schema
 */
export const UserTenantPermissionsSchema = z.object({
  canAccessAll: z.boolean().default(false).describe('Can access all properties'),
  properties: z.array(uuid).default([]).describe('Specific property access'),
  restrictions: z.record(z.unknown()).default({}).describe('Additional permission restrictions'),
});

/**
 * Base User-Tenant Association schema (without refinements)
 */
const BaseUserTenantAssociationSchema = z.object({
  id: uuid.describe('Primary key'),
  user_id: uuid.describe('User reference'),
  tenant_id: tenantIdBase.describe('Tenant reference'),
  role: TenantRoleEnum.default('STAFF').describe('User role within tenant'),
  is_active: z.boolean().default(true).describe('Association active status'),
  permissions: UserTenantPermissionsSchema.describe('User permissions within tenant'),
  valid_from: z.coerce.date().optional().describe('Access start date'),
  valid_until: z.coerce.date().optional().describe('Access end date'),
  metadata: jsonbMetadata,
  ...auditTimestamps,
  ...softDelete,
  version: z.bigint().default(BigInt(0)).describe('Optimistic locking version'),
});

/**
 * Complete User-Tenant Association schema (with validation)
 */
export const UserTenantAssociationSchema = BaseUserTenantAssociationSchema.refine(
  (data) => {
    // Validate date range if both dates are present
    if (data.valid_from && data.valid_until) {
      return validateDateRange(
        { start_date: data.valid_from, end_date: data.valid_until },
        { allowSameDay: true }
      );
    }
    return true;
  },
  {
    message: 'valid_until must be after or equal to valid_from',
    path: ['valid_until'],
  }
);

export type UserTenantAssociation = z.infer<typeof UserTenantAssociationSchema>;

/**
 * Schema for creating a new association
 */
export const CreateUserTenantAssociationSchema = BaseUserTenantAssociationSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
  deleted_at: true,
  version: true,
}).refine(
  (data) => {
    if (data.valid_from && data.valid_until) {
      return validateDateRange(
        { start_date: data.valid_from, end_date: data.valid_until },
        { allowSameDay: true }
      );
    }
    return true;
  },
  {
    message: 'valid_until must be after or equal to valid_from',
    path: ['valid_until'],
  }
);

export type CreateUserTenantAssociation = z.infer<typeof CreateUserTenantAssociationSchema>;

/**
 * Schema for updating an association
 */
export const UpdateUserTenantAssociationSchema = BaseUserTenantAssociationSchema.omit({
  id: true,
  user_id: true, // Cannot change user
  tenant_id: true, // Cannot change tenant
  created_at: true,
  created_by: true,
  deleted_at: true,
})
  .partial()
  .extend({
    id: uuid,
  });

export type UpdateUserTenantAssociation = z.infer<typeof UpdateUserTenantAssociationSchema>;

/**
 * Association with user and tenant details (for API responses)
 */
export const UserTenantAssociationWithDetailsSchema = BaseUserTenantAssociationSchema.extend({
  user: z
    .object({
      username: z.string(),
      email: z.string(),
      first_name: z.string(),
      last_name: z.string(),
    })
    .optional(),
  tenant: z
    .object({
      name: z.string(),
      slug: z.string(),
      status: z.string(),
    })
    .optional(),
});

export type UserTenantAssociationWithDetails = z.infer<
  typeof UserTenantAssociationWithDetailsSchema
>;
