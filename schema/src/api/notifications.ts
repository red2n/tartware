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
export const NotificationItemSchema = InAppNotificationSchema.pick({
	notification_id: true,
	tenant_id: true,
	property_id: true,
	user_id: true,
	title: true,
	message: true,
	category: true,
	priority: true,
	source_type: true,
	source_id: true,
	action_url: true,
	is_read: true,
	read_at: true,
	metadata: true,
	created_at: true,
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

/** Mark as read request body */
export const MarkNotificationsReadBodySchema = z.object({
	notification_ids: z.array(uuid).min(1).max(100),
});

/** Mark all as read (no body needed - uses tenant/user context) */

/** Unread count response */
export const UnreadCountResponseSchema = z.object({
	data: z.object({
		unread: z.number(),
	}),
});

/** SSE notification event — sent over the real-time stream */
export const SseNotificationEventSchema = z.object({
	type: z.enum(["notification", "unread_count", "heartbeat"]),
	data: z.unknown(),
});
