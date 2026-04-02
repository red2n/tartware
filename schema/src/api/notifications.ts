/**
 * DEV DOC
 * Module: api/notifications.ts
 * Description: API request/response schemas for in-app notifications
 * Ownership: Schema package
 */

import { z } from "zod";

import {
	InAppNotificationCategoryEnum,
	InAppNotificationPriorityEnum,
	InAppNotificationSchema,
} from "../schemas/05-operations/in-app-notifications.js";
import { uuid } from "../shared/base-schemas.js";

/** Single notification item returned from list endpoints */
export const NotificationItemSchema = z.object({
	notification_id: InAppNotificationSchema.shape.notification_id,
	tenant_id: InAppNotificationSchema.shape.tenant_id,
	property_id: InAppNotificationSchema.shape.property_id,
	user_id: InAppNotificationSchema.shape.user_id,
	title: InAppNotificationSchema.shape.title,
	message: InAppNotificationSchema.shape.message,
	category: InAppNotificationCategoryEnum,
	priority: InAppNotificationPriorityEnum,
	source_type: z.string().max(50).nullish(),
	source_id: uuid.nullish(),
	action_url: z.string().max(500).nullish(),
	is_read: z.boolean(),
	read_at: z.string().nullish(),
	metadata: z.record(z.unknown()).nullish(),
	created_at: z.string().nullish(),
});

export type NotificationItem = z.infer<typeof NotificationItemSchema>;

/** Query params for listing notifications */
export const NotificationListQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(50),
	offset: z.coerce.number().int().min(0).default(0),
	category: InAppNotificationCategoryEnum.optional(),
	is_read: z.enum(["true", "false"]).optional(),
	priority: InAppNotificationPriorityEnum.optional(),
});

/** List response */
export const NotificationListResponseSchema = z.object({
	data: z.array(NotificationItemSchema),
	meta: z.object({
		total: z.number(),
		unread: z.number(),
		limit: z.number(),
		offset: z.number(),
	}),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

/** Mark as read request body */
export const MarkNotificationsReadBodySchema = z.object({
	notification_ids: z.array(uuid).min(1).max(100),
});

/** Mark all as read (no body needed - uses tenant/user context) */

/** Unread count response */
export const UnreadCountPayloadSchema = z.object({
	unread: z.number(),
});
export type UnreadCountPayload = z.infer<typeof UnreadCountPayloadSchema>;

/** Unread count response */
export const UnreadCountResponseSchema = z.object({
	data: UnreadCountPayloadSchema,
});
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;

/** SSE notification event — sent over the real-time stream */
export const SseNotificationEventSchema = z.object({
	type: z.enum(["notification", "unread_count", "heartbeat"]),
	data: z.unknown(),
});
