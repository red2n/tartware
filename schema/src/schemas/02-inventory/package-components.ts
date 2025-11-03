/**
 * PackageComponents Schema
 * @table package_components
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete PackageComponents schema
 */
export const PackageComponentsSchema = z.object({
  component_id: uuid,
  package_id: uuid,
  component_type: z.string(),
  component_name: z.string(),
  component_description: z.string().optional(),
  service_id: uuid.optional(),
  external_reference: z.string().optional(),
  quantity: z.number().int().optional(),
  pricing_type: z.string(),
  unit_price: money.optional(),
  is_included: z.boolean().optional(),
  is_optional: z.boolean().optional(),
  additional_charge: money.optional(),
  delivery_timing: z.string().optional(),
  delivery_location: z.string().optional(),
  display_order: z.number().int().optional(),
  highlight: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_mandatory: z.boolean().optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type PackageComponents = z.infer<typeof PackageComponentsSchema>;

/**
 * Schema for creating a new package components
 */
export const CreatePackageComponentsSchema = PackageComponentsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreatePackageComponents = z.infer<typeof CreatePackageComponentsSchema>;

/**
 * Schema for updating a package components
 */
export const UpdatePackageComponentsSchema = PackageComponentsSchema.partial();

export type UpdatePackageComponents = z.infer<typeof UpdatePackageComponentsSchema>;
