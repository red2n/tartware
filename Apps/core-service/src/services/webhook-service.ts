import { query } from "../lib/db.js";

/**
 * Webhook subscription persistence.
 *
 * Column list is explicit rather than `SELECT *` so the payload matches
 * WebhookSubscriptionsSchema exactly — the gateway serialises responses with
 * `additionalProperties: false` and silently drops anything unlisted.
 */
const COLUMNS = `
  subscription_id,
  tenant_id,
  property_id,
  webhook_name,
  webhook_url,
  event_types,
  is_active,
  http_method,
  authentication_type,
  retry_count,
  retry_backoff_seconds,
  last_triggered_at,
  last_success_at,
  last_failure_at,
  success_count,
  failure_count,
  created_at,
  updated_at
`;

/** Soft-deleted rows stay in the table; every read filters them out. */
const NOT_DELETED = "COALESCE(is_deleted, false) = false";

export interface WebhookInput {
  webhook_name: string;
  webhook_url: string;
  event_types: string[];
  property_id?: string | null;
  is_active?: boolean;
  http_method?: string;
  headers?: Record<string, unknown> | null;
  authentication_type?: string | null;
  authentication_config?: Record<string, unknown> | null;
  retry_count?: number;
  retry_backoff_seconds?: number;
}

export const listWebhooks = async (tenantId: string) => {
  const res = await query(
    `SELECT ${COLUMNS}
       FROM public.webhook_subscriptions
      WHERE tenant_id = $1::uuid AND ${NOT_DELETED}
      ORDER BY created_at DESC`,
    [tenantId],
  );
  return res.rows;
};

export const getWebhook = async (tenantId: string, webhookId: string) => {
  const res = await query(
    `SELECT ${COLUMNS}
       FROM public.webhook_subscriptions
      WHERE tenant_id = $1::uuid AND subscription_id = $2::uuid AND ${NOT_DELETED}`,
    [tenantId, webhookId],
  );
  return res.rows[0] ?? null;
};

export const createWebhook = async (tenantId: string, input: WebhookInput, userId?: string) => {
  const res = await query(
    `INSERT INTO public.webhook_subscriptions
       (tenant_id, property_id, webhook_name, webhook_url, event_types, is_active,
        http_method, headers, authentication_type, authentication_config,
        retry_count, retry_backoff_seconds, created_by, updated_by)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::varchar[], COALESCE($6, true),
             COALESCE($7, 'POST'), $8::jsonb, $9, $10::jsonb,
             COALESCE($11, 3), COALESCE($12, 60), $13::uuid, $13::uuid)
     RETURNING ${COLUMNS}`,
    [
      tenantId,
      input.property_id ?? null,
      input.webhook_name,
      input.webhook_url,
      input.event_types,
      input.is_active ?? null,
      input.http_method ?? null,
      input.headers ? JSON.stringify(input.headers) : null,
      input.authentication_type ?? null,
      input.authentication_config ? JSON.stringify(input.authentication_config) : null,
      input.retry_count ?? null,
      input.retry_backoff_seconds ?? null,
      userId ?? null,
    ],
  );
  return res.rows[0];
};

/**
 * Partial update: every field is COALESCEd against its current value, so a body
 * carrying only `is_active` cannot blank out the URL or event list.
 */
export const updateWebhook = async (
  tenantId: string,
  webhookId: string,
  input: Partial<WebhookInput>,
  userId?: string,
) => {
  const res = await query(
    `UPDATE public.webhook_subscriptions
        SET webhook_name           = COALESCE($3, webhook_name),
            webhook_url            = COALESCE($4, webhook_url),
            event_types            = COALESCE($5::varchar[], event_types),
            is_active              = COALESCE($6, is_active),
            http_method            = COALESCE($7, http_method),
            headers                = COALESCE($8::jsonb, headers),
            authentication_type    = COALESCE($9, authentication_type),
            authentication_config  = COALESCE($10::jsonb, authentication_config),
            retry_count            = COALESCE($11, retry_count),
            retry_backoff_seconds  = COALESCE($12, retry_backoff_seconds),
            updated_by             = $13::uuid,
            updated_at             = NOW(),
            version                = version + 1
      WHERE tenant_id = $1::uuid AND subscription_id = $2::uuid AND ${NOT_DELETED}
      RETURNING ${COLUMNS}`,
    [
      tenantId,
      webhookId,
      input.webhook_name ?? null,
      input.webhook_url ?? null,
      input.event_types ?? null,
      input.is_active ?? null,
      input.http_method ?? null,
      input.headers ? JSON.stringify(input.headers) : null,
      input.authentication_type ?? null,
      input.authentication_config ? JSON.stringify(input.authentication_config) : null,
      input.retry_count ?? null,
      input.retry_backoff_seconds ?? null,
      userId ?? null,
    ],
  );
  return res.rows[0] ?? null;
};

/**
 * Fire a test event at the subscription's URL and record the outcome on the
 * existing counters, so a manual test looks identical to a real delivery in the
 * stats. Never throws for a bad endpoint — an unreachable URL is a legitimate
 * result the caller needs to see, not a 500.
 */
export const sendTestEvent = async (tenantId: string, webhookId: string) => {
  const webhook = await getWebhook(tenantId, webhookId);
  if (!webhook) return null;

  const payload = {
    event_type: "webhook.test",
    tenant_id: tenantId,
    subscription_id: webhookId,
    sent_at: new Date().toISOString(),
    data: { message: "Test event from Tartware" },
  };

  const started = Date.now();
  let status: number | null = null;
  let error: string | null = null;

  try {
    // Bounded so a hanging endpoint cannot hold the request open indefinitely.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(webhook.webhook_url, {
        method: webhook.http_method === "PUT" ? "PUT" : "POST",
        headers: { "content-type": "application/json", ...(webhook.headers ?? {}) },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      status = res.status;
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Request failed";
  }

  const ok = status !== null && status >= 200 && status < 300;
  await query(
    `UPDATE public.webhook_subscriptions
        SET last_triggered_at = NOW(),
            last_success_at   = CASE WHEN $3 THEN NOW() ELSE last_success_at END,
            last_failure_at   = CASE WHEN $3 THEN last_failure_at ELSE NOW() END,
            success_count     = success_count + CASE WHEN $3 THEN 1 ELSE 0 END,
            failure_count     = failure_count + CASE WHEN $3 THEN 0 ELSE 1 END
      WHERE tenant_id = $1::uuid AND subscription_id = $2::uuid`,
    [tenantId, webhookId, ok],
  );

  const durationMs = Date.now() - started;
  await query(
    `INSERT INTO public.webhook_deliveries
       (tenant_id, webhook_id, event_type, status, http_status_code, attempt,
        error_message, payload, duration_ms)
     VALUES ($1::uuid, $2::uuid, 'webhook.test', $3, $4, 1, $5, $6::jsonb, $7)`,
    [
      tenantId,
      webhookId,
      ok ? "delivered" : "failed",
      status,
      error,
      JSON.stringify(payload),
      durationMs,
    ],
  );

  return { delivered: ok, response_status: status, error, duration_ms: durationMs };
};

/** Delivery attempts for a subscription, most recent first. */
export const listDeliveries = async (tenantId: string, webhookId: string, limit = 100) => {
  const res = await query(
    `SELECT delivery_id, webhook_id, event_type, status, http_status_code,
            attempt, error_message, duration_ms, created_at
       FROM public.webhook_deliveries
      WHERE tenant_id = $1::uuid AND webhook_id = $2::uuid
        AND COALESCE(is_deleted, false) = false
      ORDER BY created_at DESC
      LIMIT $3`,
    [tenantId, webhookId, limit],
  );
  return res.rows;
};

/** Soft delete — keeps delivery history meaningful. */
export const deleteWebhook = async (tenantId: string, webhookId: string, userId?: string) => {
  const res = await query(
    `UPDATE public.webhook_subscriptions
        SET is_deleted = true, deleted_at = NOW(), deleted_by = $3::uuid
      WHERE tenant_id = $1::uuid AND subscription_id = $2::uuid AND ${NOT_DELETED}
      RETURNING subscription_id`,
    [tenantId, webhookId, userId ?? null],
  );
  return res.rows.length > 0;
};
