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
// =====================================================
// NOTIFICATION PROVIDER CONTRACTS (service-layer)
// =====================================================

/** Payload passed to a notification delivery provider. */
export type NotificationPayload = {
	/** Recipient display name */
	recipientName: string;
	/** Recipient email (for email channel) */
	recipientEmail?: string;
	/** Recipient phone (for SMS channel) */
	recipientPhone?: string;
	/** Notification subject */
	subject: string;
	/** Plain text body */
	body: string;
	/** HTML body (for email) */
	htmlBody?: string;
	/** Sender display name */
	senderName?: string;
	/** Sender email */
	senderEmail?: string;
	/** Additional metadata */
	metadata?: Record<string, unknown>;
};

/** Result returned by a notification delivery provider after a dispatch attempt. */
export type DispatchResult = {
	/** Whether the dispatch succeeded */
	success: boolean;
	/** External provider message ID (e.g., SendGrid message ID) */
	externalMessageId?: string;
	/** Error message on failure */
	error?: string;
	/** Provider name that handled delivery */
	provider: string;
};

// =====================================================
// SERVICE-LAYER INPUT TYPES
// =====================================================

/**
 * Parameters for dispatching a guest notification via the template engine.
 * Used by `sendNotification()` in notification-dispatch-service.
 */
export type SendNotificationParams = {
	tenantId: string;
	propertyId: string;
	guestId: string;
	reservationId?: string | null;
	templateCode: string;
	recipientName: string;
	recipientEmail?: string | null;
	recipientPhone?: string | null;
	context: Record<string, string | number | boolean | null | undefined>;
	initiatedBy?: string | null;
	idempotencyKey?: string | null;
};

/**
 * Parameters for publishing a notification command from an upstream service
 * (e.g., rooms-service triggering a guest notification via the command topic).
 */
export type RoomNotificationCommandInput = {
	tenantId: string;
	propertyId: string;
	guestId: string;
	reservationId?: string;
	templateCode: string;
	recipientName?: string;
	recipientEmail?: string;
	context: Record<string, string | number | boolean | null>;
	idempotencyKey: string;
	initiatedBy?: { userId?: string } | null;
};

/**
 * Interface for notification delivery providers.
 *
 * Implementations must be stateless and safe for concurrent invocations.
 */
export interface NotificationProvider {
	/** Unique provider identifier */
	readonly name: string;

	/** Supported communication channels */
	readonly supportedChannels: ReadonlyArray<string>;

	/**
	 * Dispatch a notification to the recipient.
	 *
	 * @param payload - The notification content and recipient details
	 * @returns Result of the dispatch attempt
	 */
	dispatch(payload: NotificationPayload): Promise<DispatchResult>;
}
