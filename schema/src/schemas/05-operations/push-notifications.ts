/**
 * PushNotifications Schema
 * @table push_notifications
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete PushNotifications schema
 */
export const PushNotificationsSchema = z.object({
	notification_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	recipient_type: z.string().optional(),
	recipient_id: uuid.optional(),
	guest_id: uuid.optional(),
	notification_type: z.string().optional(),
	title: z.string(),
	message: z.string(),
	status: z.string().optional(),
	scheduled_at: z.coerce.date().optional(),
	sent_at: z.coerce.date().optional(),
	delivered_at: z.coerce.date().optional(),
	opened_at: z.coerce.date().optional(),
	device_token: z.string().optional(),
	platform: z.string().optional(),
	action_url: z.string().optional(),
	custom_data: z.record(z.unknown()).optional(),
	priority: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type PushNotifications = z.infer<typeof PushNotificationsSchema>;

/**
 * Schema for creating a new push notifications
 */
export const CreatePushNotificationsSchema = PushNotificationsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreatePushNotifications = z.infer<
	typeof CreatePushNotificationsSchema
>;

/**
 * Schema for updating a push notifications
 */
export const UpdatePushNotificationsSchema = PushNotificationsSchema.partial();

export type UpdatePushNotifications = z.infer<
	typeof UpdatePushNotificationsSchema
>;
