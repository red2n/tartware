/**
 * DEV DOC
 * Module: schemas/01-core/room-settings.ts
 * Description: RoomSettings Schema
 * Table: room_settings
 * Category: 01-core
 * Primary exports: RoomSettingsSchema, CreateRoomSettingsSchema, UpdateRoomSettingsSchema
 * @table room_settings
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * RoomSettings Schema
 * @table room_settings
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete RoomSettings schema
 */
export const RoomSettingsSchema = z.object({
	room_setting_id: uuid,
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	room_id: uuid,
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

export type RoomSettings = z.infer<typeof RoomSettingsSchema>;

/**
 * Schema for creating a new room settings
 */
export const CreateRoomSettingsSchema = RoomSettingsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateRoomSettings = z.infer<typeof CreateRoomSettingsSchema>;

/**
 * Schema for updating a room settings
 */
export const UpdateRoomSettingsSchema = RoomSettingsSchema.partial();

export type UpdateRoomSettings = z.infer<typeof UpdateRoomSettingsSchema>;
