/**
 * Payment Gateway Webhook Route — P0-2
 *
 * POST /v1/billing/webhooks/payment-gateway
 *
 * Receives async payment-lifecycle events from payment gateways (Stripe, Adyen, etc.).
 * Responds 200 immediately after validating + persisting; dispatches handlers asynchronously.
 *
 * Security (PCI-DSS v4.0):
 *   - HMAC-SHA256 verification (timingSafeEqual — no timing oracle)
 *   - Idempotency via unique constraint on (tenant_id, gateway_provider, gateway_event_id)
 *   - No JWT required — webhook callers are payment gateways, not users
 *   - Raw body captured before JSON parse for byte-exact HMAC validation
 *
 * Performance (20K ops/sec):
 *   - Two DB queries before 200 (secret lookup + INSERT); dispatch is setImmediate fire-and-forget
 *   - No Zod parsing of raw gateway payload — treated as opaque JSONB
 *
 * Gateway webhook URL format:
 *   https://<host>/v1/billing/webhooks/payment-gateway?tenant_id=<uuid>&provider=STRIPE
 *
 * Signature headers accepted:
 *   Stripe:  Stripe-Signature: t=<ts>,v1=<hex>
 *   Generic: X-Webhook-Signature: sha256=<hex>
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { BillingPaymentGatewayProviderEnum } from "@tartware/schemas";

import {
  dispatchWebhookEvent,
  extractEventType,
  extractGatewayEventId,
  fetchGatewaySecret,
  insertWebhookEvent,
  verifyWebhookSignature,
} from "../services/webhook-dispatcher.js";

// ---------------------------------------------------------------------------
// Route-local query param schema (allowed: route-specific param schemas).
// `provider` is validated against the canonical PaymentGatewayProviderEnum
// from @tartware/schemas — the single source of truth for supported PSPs.
// ---------------------------------------------------------------------------
const WebhookQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  provider: z
    .string()
    .min(1)
    .max(50)
    .transform((s) => s.toUpperCase())
    .pipe(BillingPaymentGatewayProviderEnum),
  property_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Route Registration
// ---------------------------------------------------------------------------

export const registerWebhookRoutes = (app: FastifyInstance): void => {
  // Encapsulate in a child scope so addContentTypeParser applies only here.
  // The parent app's JSON parser is untouched.
  void app.register(webhookPlugin);
};

const webhookPlugin: FastifyPluginAsync = async (scope) => {
  // Override JSON parser for this scope: receive raw Buffer so HMAC can be computed
  // on the exact bytes the gateway signed, then also expose the parsed JSON.
  scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    try {
      const parsed = JSON.parse((body as Buffer).toString("utf8")) as Record<string, unknown>;
      // Merge __rawBody LAST so gateway payloads cannot shadow it
      done(null, { ...parsed, __rawBody: body });
    } catch (e) {
      done(e as Error, undefined);
    }
  });

  scope.post(
    "/v1/billing/webhooks/payment-gateway",
    {
      schema: {
        description:
          "Inbound payment-gateway webhook endpoint. HMAC-SHA256 verified, idempotent, async dispatch.",
        tags: ["Webhooks"],
        querystring: {
          type: "object",
          required: ["tenant_id", "provider"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
            provider: { type: "string", minLength: 1, maxLength: 50 },
            property_id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: { type: "object", properties: { received: { type: "boolean" } } },
          401: { type: "object", properties: { error: { type: "string" } } },
          422: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      // 1. Validate query params
      const queryResult = WebhookQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        return reply
          .status(422)
          .send({ error: `Invalid query parameters: ${queryResult.error.message}` });
      }
      const { tenant_id, provider, property_id } = queryResult.data;

      // 2. Extract raw body (Buffer) for HMAC verification
      const body = request.body as Record<string, unknown> & { __rawBody: Buffer };
      const rawBody: Buffer = body.__rawBody;
      // Remove the internal sentinel before persisting raw_payload
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { __rawBody: _discarded, ...rawPayload } = body;

      // 3. Extract signature header (Stripe or generic)
      const sigHeader =
        (request.headers["stripe-signature"] as string | undefined) ??
        (request.headers["x-webhook-signature"] as string | undefined) ??
        "";

      // 4. Fetch gateway secret — 401 fast if provider not configured
      const secret = await fetchGatewaySecret(tenant_id, provider);
      if (!secret) {
        return reply.status(401).send({ error: "Webhook provider not configured for tenant" });
      }

      // 5. HMAC verification (constant-time)
      if (!verifyWebhookSignature(rawBody, sigHeader, secret)) {
        return reply.status(401).send({ error: "Webhook signature verification failed" });
      }

      // 6. Extract normalized event fields from payload
      const gatewayEventId = extractGatewayEventId(rawPayload);
      if (!gatewayEventId) {
        return reply.status(422).send({ error: "Could not identify gateway event ID in payload" });
      }
      const eventType = extractEventType(rawPayload);

      // 7. Persist webhook event (idempotent — ON CONFLICT DO NOTHING)
      const webhookId = await insertWebhookEvent(
        tenant_id,
        property_id ?? null,
        provider,
        gatewayEventId,
        eventType,
        rawPayload,
      );

      // 8. Fire-and-forget dispatch (webhook_id null = duplicate → skip dispatch)
      if (webhookId) {
        setImmediate(() => {
          void dispatchWebhookEvent(tenant_id, webhookId, eventType, rawPayload);
        });
      }

      // 9. 200 OK — gateways retry on non-200; always return success after HMAC passes
      return reply.status(200).send({ received: true });
    },
  );
};
