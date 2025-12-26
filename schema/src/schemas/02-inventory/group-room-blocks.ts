/**
 * GroupRoomBlocks Schema
 * @table group_room_blocks
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete GroupRoomBlocks schema
 */
export const GroupRoomBlocksSchema = z.object({
  block_id: uuid,
  group_booking_id: uuid,
  room_type_id: uuid,
  block_date: z.coerce.date(),
  blocked_rooms: z.number().int(),
  picked_rooms: z.number().int().optional(),
  confirmed_rooms: z.number().int().optional(),
  available_rooms: z.number().int().optional(),
  negotiated_rate: money,
  rack_rate: money.optional(),
  discount_percentage: money.optional(),
  block_status: z.string().optional(),
  released_date: z.coerce.date().optional(),
  released_by: uuid.optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type GroupRoomBlocks = z.infer<typeof GroupRoomBlocksSchema>;

/**
 * Schema for creating a new group room blocks
 */
export const CreateGroupRoomBlocksSchema = GroupRoomBlocksSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateGroupRoomBlocks = z.infer<typeof CreateGroupRoomBlocksSchema>;

/**
 * Schema for updating a group room blocks
 */
export const UpdateGroupRoomBlocksSchema = GroupRoomBlocksSchema.partial();

export type UpdateGroupRoomBlocks = z.infer<typeof UpdateGroupRoomBlocksSchema>;
