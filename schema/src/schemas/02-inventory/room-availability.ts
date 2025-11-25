/**
 * RoomAvailability Schema
 * @table room_availability
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';
import { AvailabilityStatusEnum } from '../../shared/enums.js';

/**
 * Complete RoomAvailability schema
 */
export const RoomAvailabilitySchema = z.object({
  id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  room_type_id: uuid,
  rate_plan_id: uuid,
  availability_date: z.coerce.date(),
  base_capacity: z.number().int().nonnegative(),
  available_rooms: z.number().int().nonnegative(),
  booked_rooms: z.number().int().nonnegative(),
  blocked_rooms: z.number().int().nonnegative(),
  housekeeping_hold_rooms: z.number().int().nonnegative(),
  out_of_order_rooms: z.number().int().nonnegative(),
  oversell_limit: z.number().int().nonnegative(),
  channel_allocations: z.record(z.unknown()).optional(),
  base_price: money.optional(),
  dynamic_price: money.optional(),
  rate_override: money.optional(),
  currency: z.string().length(3).optional(),
  min_length_of_stay: z.number().int().optional(),
  max_length_of_stay: z.number().int().optional(),
  min_stay_override: z.number().int().optional(),
  max_stay_override: z.number().int().optional(),
  closed_to_arrival: z.boolean().optional(),
  closed_to_departure: z.boolean().optional(),
  stop_sell: z.boolean().optional(),
  is_closed: z.boolean().optional(),
  release_back_minutes: z.number().int().nonnegative().optional(),
  status: AvailabilityStatusEnum,
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

export type RoomAvailability = z.infer<typeof RoomAvailabilitySchema>;

/**
 * Schema for creating a new room availability
 */
export const CreateRoomAvailabilitySchema = RoomAvailabilitySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
  is_deleted: true,
  deleted_at: true,
  deleted_by: true,
  version: true,
});

export type CreateRoomAvailability = z.infer<typeof CreateRoomAvailabilitySchema>;

/**
 * Schema for updating a room availability
 */
export const UpdateRoomAvailabilitySchema = RoomAvailabilitySchema.partial();

export type UpdateRoomAvailability = z.infer<typeof UpdateRoomAvailabilitySchema>;
