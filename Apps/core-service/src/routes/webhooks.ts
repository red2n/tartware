import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance } from "fastify";

import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  listDeliveries,
  listWebhooks,
  sendTestEvent,
  updateWebhook,
  type WebhookInput,
} from "../services/webhook-service.js";

const WEBHOOKS_TAG = "Webhooks";

type TenantParams = { tenantId: string };
type WebhookParams = { tenantId: string; webhookId: string };

/**
 * Webhook subscription CRUD. The gateway proxies /v1/tenants/:tenantId/webhooks
 * here, so paths must match its declarations exactly.
 */
export const registerWebhookRoutes = (app: FastifyInstance): void => {
  const tenantScope = app.withTenantScope({
    resolveTenantId: (request) => (request.params as TenantParams).tenantId,
    minRole: "ADMIN",
    requiredModules: "core",
  });

  app.get<{ Params: TenantParams }>(
    "/v1/tenants/:tenantId/webhooks",
    {
      preHandler: tenantScope,
      schema: buildRouteSchema({
        tag: WEBHOOKS_TAG,
        summary: "List webhook subscriptions for a tenant",
        response: { 200: jsonObjectSchema },
      }),
    },
    async (request) => ({ data: await listWebhooks(request.params.tenantId) }),
  );

  app.post<{ Params: TenantParams; Body: WebhookInput }>(
    "/v1/tenants/:tenantId/webhooks",
    {
      preHandler: tenantScope,
      schema: buildRouteSchema({
        tag: WEBHOOKS_TAG,
        summary: "Create a webhook subscription",
        response: { 201: jsonObjectSchema },
      }),
    },
    async (request, reply) => {
      const created = await createWebhook(
        request.params.tenantId,
        request.body,
        request.auth.userId ?? undefined,
      );
      reply.code(201);
      return created;
    },
  );

  app.get<{ Params: WebhookParams }>(
    "/v1/tenants/:tenantId/webhooks/:webhookId",
    {
      preHandler: tenantScope,
      schema: buildRouteSchema({
        tag: WEBHOOKS_TAG,
        summary: "Get a webhook subscription",
        response: { 200: jsonObjectSchema },
      }),
    },
    async (request, reply) => {
      const row = await getWebhook(request.params.tenantId, request.params.webhookId);
      if (!row) {
        reply.notFound("Webhook subscription not found");
        return reply;
      }
      return row;
    },
  );

  app.put<{ Params: WebhookParams; Body: Partial<WebhookInput> }>(
    "/v1/tenants/:tenantId/webhooks/:webhookId",
    {
      preHandler: tenantScope,
      schema: buildRouteSchema({
        tag: WEBHOOKS_TAG,
        summary: "Update a webhook subscription",
        response: { 200: jsonObjectSchema },
      }),
    },
    async (request, reply) => {
      const row = await updateWebhook(
        request.params.tenantId,
        request.params.webhookId,
        request.body,
        request.auth.userId ?? undefined,
      );
      if (!row) {
        reply.notFound("Webhook subscription not found");
        return reply;
      }
      return row;
    },
  );

  app.get<{ Params: WebhookParams; Querystring: { limit?: number } }>(
    "/v1/tenants/:tenantId/webhooks/:webhookId/deliveries",
    {
      preHandler: tenantScope,
      schema: buildRouteSchema({
        tag: WEBHOOKS_TAG,
        summary: "List delivery attempts for a webhook subscription",
        response: { 200: jsonObjectSchema },
      }),
    },
    async (request) => ({
      data: await listDeliveries(
        request.params.tenantId,
        request.params.webhookId,
        request.query.limit ?? 100,
      ),
    }),
  );

  app.post<{ Params: WebhookParams }>(
    "/v1/tenants/:tenantId/webhooks/:webhookId/test",
    {
      preHandler: tenantScope,
      schema: buildRouteSchema({
        tag: WEBHOOKS_TAG,
        summary: "Send a test event to a webhook endpoint",
        response: { 200: jsonObjectSchema },
      }),
    },
    async (request, reply) => {
      const result = await sendTestEvent(request.params.tenantId, request.params.webhookId);
      if (!result) {
        reply.notFound("Webhook subscription not found");
        return reply;
      }
      // A non-2xx from the customer's endpoint is a successful test *run* —
      // the outcome is in the body, so this stays 200.
      return result;
    },
  );

  app.delete<{ Params: WebhookParams }>(
    "/v1/tenants/:tenantId/webhooks/:webhookId",
    {
      preHandler: tenantScope,
      schema: buildRouteSchema({
        tag: WEBHOOKS_TAG,
        summary: "Delete a webhook subscription",
        response: { 200: jsonObjectSchema },
      }),
    },
    async (request, reply) => {
      const removed = await deleteWebhook(
        request.params.tenantId,
        request.params.webhookId,
        request.auth.userId ?? undefined,
      );
      if (!removed) {
        reply.notFound("Webhook subscription not found");
        return reply;
      }
      return { subscription_id: request.params.webhookId, deleted: true };
    },
  );
};
