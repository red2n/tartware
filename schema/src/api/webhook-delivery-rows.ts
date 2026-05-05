/**
 * DEV DOC
 * Module: api/webhook-delivery-rows.ts
 * Purpose: Raw row / DTO shapes for webhook delivery log entries returned by
 *          the webhook subscription endpoints (GET /tenants/:tenantId/webhooks/:webhookId/deliveries).
 * Ownership: Schema package
 */

/** Single webhook delivery attempt as returned by the deliveries endpoint. */
export type WebhookDeliveryRow = {
	delivery_id: string;
	webhook_id?: string;
	event_type?: string | null;
	status?: string | null;
	http_status_code?: number | null;
	attempt?: number | null;
	error_message?: string | null;
	created_at?: string | null;
};
