/**
 * DEV DOC
 * Module: schemas/06-integrations/webhook-deliveries.ts
 * Description: WebhookDeliveries Schema
 * Table: webhook_deliveries
 * Category: 06-integrations
 * Primary exports: WebhookDeliveriesSchema, CreateWebhookDeliveriesSchema, UpdateWebhookDeliveriesSchema
 * @table webhook_deliveries
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * WebhookDeliveries Schema
 * @table webhook_deliveries
 * @category 06-integrations
 * @synchronized 2026-08-10
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete WebhookDeliveries schema
 *
 * One row per delivery attempt against a webhook_subscriptions row, so a
 * retry is a new row rather than an overwrite of the previous outcome.
 */
export const WebhookDeliveriesSchema = z.object({
	delivery_id: uuid,
	tenant_id: uuid,
	/** Owning subscription (webhook_subscriptions.subscription_id). */
	webhook_id: uuid,
	event_type: z.string().max(100).optional(),
	/** Mirrors the table's CHECK constraint on status. */
	status: z.enum(["pending", "delivered", "failed"]).optional(),
	http_status_code: z.number().int().optional(),
	/** Attempt number for this delivery, starting at 1. */
	attempt: z.number().int().optional(),
	error_message: z.string().optional(),
	/** Body sent to the endpoint, retained so a delivery can be replayed. */
	payload: z.record(z.unknown()).optional(),
	duration_ms: z.number().int().optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
});

export type WebhookDeliveries = z.infer<typeof WebhookDeliveriesSchema>;

/**
 * Schema for creating a new webhook delivery
 *
 * delivery_id and created_at are database-assigned; attempt/status carry
 * defaults, so a caller only has to name the subscription and the outcome.
 */
export const CreateWebhookDeliveriesSchema = WebhookDeliveriesSchema.omit({
	delivery_id: true,
	created_at: true,
	updated_at: true,
});

export type CreateWebhookDeliveries = z.infer<
	typeof CreateWebhookDeliveriesSchema
>;

/**
 * Schema for updating a webhook delivery
 */
export const UpdateWebhookDeliveriesSchema = WebhookDeliveriesSchema.partial();

export type UpdateWebhookDeliveries = z.infer<
	typeof UpdateWebhookDeliveriesSchema
>;
