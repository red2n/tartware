/**
 * DEV DOC
 * Module: schemas/05-operations/notification-read-receipts.ts
 * Description: NotificationReadReceipts Schema
 * Table: notification_read_receipts
 * Category: 05-operations
 * Primary exports: NotificationReadReceiptSchema
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Full notification read receipt schema (DB row shape).
 *
 * Tracks per-user read state for broadcast notifications
 * (where `in_app_notifications.user_id IS NULL`).
 */
export const NotificationReadReceiptSchema = z.object({
	receipt_id: uuid,
	notification_id: uuid,
	user_id: uuid,
	tenant_id: uuid,
	read_at: z.coerce.date(),
});

export type NotificationReadReceipt = z.infer<
	typeof NotificationReadReceiptSchema
>;
