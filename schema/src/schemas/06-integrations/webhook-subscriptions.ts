/**
 * WebhookSubscriptions Schema
 * @table webhook_subscriptions
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete WebhookSubscriptions schema
 */
export const WebhookSubscriptionsSchema = z.object({
	subscription_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	webhook_name: z.string(),
	webhook_url: z.string(),
	event_types: z.array(z.string()),
	is_active: z.boolean().optional(),
	http_method: z.string().optional(),
	headers: z.record(z.unknown()).optional(),
	authentication_type: z.string().optional(),
	authentication_config: z.record(z.unknown()).optional(),
	retry_count: z.number().int().optional(),
	retry_backoff_seconds: z.number().int().optional(),
	last_triggered_at: z.coerce.date().optional(),
	last_success_at: z.coerce.date().optional(),
	last_failure_at: z.coerce.date().optional(),
	success_count: z.number().int().optional(),
	failure_count: z.number().int().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type WebhookSubscriptions = z.infer<typeof WebhookSubscriptionsSchema>;

/**
 * Schema for creating a new webhook subscriptions
 */
export const CreateWebhookSubscriptionsSchema = WebhookSubscriptionsSchema.omit(
	{
		// TODO: Add fields to omit for creation
	},
);

export type CreateWebhookSubscriptions = z.infer<
	typeof CreateWebhookSubscriptionsSchema
>;

/**
 * Schema for updating a webhook subscriptions
 */
export const UpdateWebhookSubscriptionsSchema =
	WebhookSubscriptionsSchema.partial();

export type UpdateWebhookSubscriptions = z.infer<
	typeof UpdateWebhookSubscriptionsSchema
>;
