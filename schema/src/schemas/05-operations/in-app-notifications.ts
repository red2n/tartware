/**
 * DEV DOC
 * Module: schemas/05-operations/in-app-notifications.ts
 * Description: InAppNotifications Schema
 * Table: in_app_notifications
 * Category: 05-operations
 * Primary exports: InAppNotificationSchema, CreateInAppNotificationSchema
 * @table in_app_notifications
 * @category 05-operations
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/** Notification category enum — matches CHECK constraint on the table */
export const InAppNotificationCategoryEnum = z.enum([
	"reservation",
	"checkin",
	"checkout",
	"payment",
	"housekeeping",
	"maintenance",
	"rate",
	"guest",
	"system",
	"info",
	"alert",
]);

/** Notification priority enum */
export const InAppNotificationPriorityEnum = z.enum([
	"low",
	"normal",
	"high",
	"urgent",
]);

/**
 * Full in-app notification schema (DB row shape).
 */
export const InAppNotificationSchema = z.object({
	notification_id: uuid,
	tenant_id: uuid,
	property_id: uuid.nullish(),
	user_id: uuid.nullish(),
	title: z.string().max(255),
	message: z.string(),
	category: InAppNotificationCategoryEnum,
	priority: InAppNotificationPriorityEnum,
	source_type: z.string().max(50).nullish(),
	source_id: uuid.nullish(),
	action_url: z.string().max(500).nullish(),
	is_read: z.boolean(),
	read_at: z.coerce.date().nullish(),
	metadata: z.record(z.unknown()).nullish(),
	created_at: z.coerce.date().nullish(),
	expires_at: z.coerce.date().nullish(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().nullish(),
});

export type InAppNotification = z.infer<typeof InAppNotificationSchema>;

/**
 * Schema for creating an in-app notification (used internally by the service).
 */
export const CreateInAppNotificationSchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	user_id: uuid.optional(),
	title: z.string().min(1).max(255),
	message: z.string().min(1),
	category: InAppNotificationCategoryEnum.default("info"),
	priority: InAppNotificationPriorityEnum.default("normal"),
	source_type: z.string().max(50).optional(),
	source_id: uuid.optional(),
	action_url: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	expires_at: z.coerce.date().optional(),
});

export type CreateInAppNotification = z.infer<
	typeof CreateInAppNotificationSchema
>;
