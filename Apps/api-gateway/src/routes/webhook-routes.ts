import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import { forwardCommandWithParamId, forwardCommandWithTenant } from "./command-helpers.js";
import {
  commandAcceptedSchema,
  paginatedListSchema,
  paginationQuerySchema,
  reservationParamsSchema,
  tenantWebhookParamsSchema,
  WEBHOOK_TAG,
  webhookDeliverySchema,
  webhookSubscriptionSchema,
} from "./schemas.js";

export const registerWebhookRoutes = (app: FastifyInstance): void => {
  const proxyCore = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.coreServiceUrl);

  const tenantScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "ADMIN",
    requiredModules: "core",
  });

  // ─── Subscription Management ──────────────────────────────

  app.get(
    "/v1/tenants/:tenantId/webhooks",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: WEBHOOK_TAG,
        summary: "List webhook subscriptions for a tenant.",
        params: reservationParamsSchema,
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: webhookSubscriptionSchema },
            },
            required: ["data"],
            additionalProperties: false,
          },
        },
      }),
    },
    proxyCore,
  );

  app.post(
    "/v1/tenants/:tenantId/webhooks",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: WEBHOOK_TAG,
        summary: "Create a webhook subscription via Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "webhook.subscription.create",
      }),
  );

  app.get(
    "/v1/tenants/:tenantId/webhooks/:webhookId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: WEBHOOK_TAG,
        summary: "Get a specific webhook subscription.",
        params: tenantWebhookParamsSchema,
        response: { 200: webhookSubscriptionSchema },
      }),
    },
    proxyCore,
  );

  app.put(
    "/v1/tenants/:tenantId/webhooks/:webhookId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: WEBHOOK_TAG,
        summary: "Update a webhook subscription via Command Center.",
        params: tenantWebhookParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "webhook.subscription.update",
        paramKey: "webhookId",
        payloadKey: "webhook_id",
      }),
  );

  app.delete(
    "/v1/tenants/:tenantId/webhooks/:webhookId",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: WEBHOOK_TAG,
        summary: "Delete a webhook subscription via Command Center.",
        params: tenantWebhookParamsSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "webhook.subscription.delete",
        paramKey: "webhookId",
        payloadKey: "webhook_id",
      }),
  );

  // ─── Signing Key Management ──────────────────────────────

  app.post(
    "/v1/tenants/:tenantId/webhooks/:webhookId/rotate-secret",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: WEBHOOK_TAG,
        summary: "Rotate the HMAC signing secret for a webhook.",
        params: tenantWebhookParamsSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "webhook.secret.rotate",
        paramKey: "webhookId",
        payloadKey: "webhook_id",
      }),
  );

  // ─── Delivery Log & Replay ──────────────────────────────

  app.get(
    "/v1/tenants/:tenantId/webhooks/:webhookId/deliveries",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: WEBHOOK_TAG,
        summary: "List delivery attempts for a webhook subscription.",
        params: tenantWebhookParamsSchema,
        querystring: paginationQuerySchema,
        response: {
          200: paginatedListSchema(webhookDeliverySchema),
        },
      }),
    },
    proxyCore,
  );

  app.post(
    "/v1/tenants/:tenantId/webhooks/:webhookId/replay",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: WEBHOOK_TAG,
        summary: "Replay failed deliveries for a webhook subscription.",
        params: tenantWebhookParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "webhook.delivery.replay",
        paramKey: "webhookId",
        payloadKey: "webhook_id",
      }),
  );

  // ─── Webhook Test ──────────────────────────────────────

  app.post(
    "/v1/tenants/:tenantId/webhooks/:webhookId/test",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: WEBHOOK_TAG,
        summary: "Send a test event to a webhook endpoint.",
        params: tenantWebhookParamsSchema,
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCore,
  );
};
