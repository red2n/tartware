/**
 * DEV DOC
 * Module: events/commands/notifications.ts
 * Description: Notification command schemas for guest communication dispatch
 * Primary exports: NotificationSendCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

/**
 * Command schema for sending a notification to a guest.
 * Dispatched as `notification.send` on the `commands.primary` topic.
 */
export const NotificationSendCommandSchema = z.object({
	guest_id: z.string().uuid(),
	property_id: z.string().uuid(),
	template_code: z.string().min(1).max(100),
	recipient_name: z.string().max(200).optional(),
	recipient_email: z.string().email().optional(),
	recipient_phone: z.string().max(30).optional(),
	reservation_id: z.string().uuid().optional(),
	idempotency_key: z.string().uuid().optional(),
	context: z.record(z.string(), z.string()).optional(),
});

export type NotificationSendCommand = z.infer<
	typeof NotificationSendCommandSchema
>;
