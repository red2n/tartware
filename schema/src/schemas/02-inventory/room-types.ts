/**
 * RoomTypes Schema
 * @table room_types
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';
import { RoomCategoryEnum } from '../../shared/enums.js';

/**
 * Complete RoomTypes schema
 */
export const RoomTypesSchema = z.object({
  id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  type_name: z.string(),
  type_code: z.string(),
  description: z.string().optional(),
  short_description: z.string().optional(),
  category: RoomCategoryEnum,
  base_occupancy: z.number().int(),
  max_occupancy: z.number().int(),
  max_adults: z.number().int(),
  max_children: z.number().int().optional(),
  extra_bed_capacity: z.number().int().optional(),
  size_sqm: money.optional(),
  bed_type: z.string().optional(),
  number_of_beds: z.number().int().optional(),
  amenities: z.record(z.unknown()).optional(),
  features: z.record(z.unknown()).optional(),
  base_price: money,
  currency: z.string().optional(),
  images: z.record(z.unknown()).optional(),
  display_order: z.number().int().optional(),
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

export type RoomTypes = z.infer<typeof RoomTypesSchema>;

/**
 * Schema for creating a new room types
 */
export const CreateRoomTypesSchema = RoomTypesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateRoomTypes = z.infer<typeof CreateRoomTypesSchema>;

/**
 * Schema for updating a room types
 */
export const UpdateRoomTypesSchema = RoomTypesSchema.partial();

export type UpdateRoomTypes = z.infer<typeof UpdateRoomTypesSchema>;
