/**
 * DEV DOC
 * Module: schemas/02-inventory/room-availability.ts
 * Description: RoomAvailability Schema
 * Table: room_availability
 * Category: 02-inventory
 * Primary exports: RoomAvailabilitySchema, CreateRoomAvailabilitySchema, UpdateRoomAvailabilitySchema
 * @table room_availability
 * @category 02-inventory
 * Ownership: Schema package
 */

/**
 * RoomAvailability Schema
 * @table room_availability
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

/**
 * Complete RoomAvailability schema
 */
export const RoomAvailabilitySchema = z.object({

});

export type RoomAvailability = z.infer<typeof RoomAvailabilitySchema>;

/**
 * Schema for creating a new room availability
 */
export const CreateRoomAvailabilitySchema = RoomAvailabilitySchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateRoomAvailability = z.infer<typeof CreateRoomAvailabilitySchema>;

/**
 * Schema for updating a room availability
 */
export const UpdateRoomAvailabilitySchema = RoomAvailabilitySchema.partial();

export type UpdateRoomAvailability = z.infer<typeof UpdateRoomAvailabilitySchema>;
