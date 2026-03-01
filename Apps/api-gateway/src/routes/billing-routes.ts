import { buildRouteSchema, jsonObjectSchema } from "@tartware/openapi";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { serviceTargets } from "../config.js";
import { proxyRequest } from "../utils/proxy.js";

import {
  forwardBillingCaptureCommand,
  forwardBillingRefundCommand,
  forwardCommandWithParamId,
  forwardCommandWithTenant,
} from "./command-helpers.js";
import {
  BILLING_COMMAND_TAG,
  BILLING_PROXY_TAG,
  commandAcceptedSchema,
  paginationQuerySchema,
  reservationParamsSchema,
  tenantInvoiceParamsSchema,
  tenantPaymentParamsSchema,
} from "./schemas.js";

export const registerBillingRoutes = (app: FastifyInstance): void => {
  const proxyBilling = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.billingServiceUrl);

  const tenantScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "STAFF",
    requiredModules: "core",
  });

  const tenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "VIEWER",
    requiredModules: "core",
  });

  app.get(
    "/v1/billing/payments",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy billing payment requests to the billing service.",
        querystring: paginationQuerySchema,
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyBilling,
  );

  app.post(
    "/v1/tenants/:tenantId/billing/payments/capture",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Capture a payment via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    forwardBillingCaptureCommand,
  );

  app.post(
    "/v1/tenants/:tenantId/billing/payments/:paymentId/refund",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Refund a payment via the Command Center.",
        params: tenantPaymentParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    forwardBillingRefundCommand,
  );

  app.post(
    "/v1/tenants/:tenantId/billing/invoices",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Create an invoice via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "billing.invoice.create",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/invoices/:invoiceId/adjust",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Adjust an invoice via the Command Center.",
        params: tenantInvoiceParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.invoice.adjust",
        paramKey: "invoiceId",
        payloadKey: "invoice_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/charges",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Post a charge via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "billing.charge.post",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/payments/:paymentId/apply",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Apply a payment via the Command Center.",
        params: tenantPaymentParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.payment.apply",
        paramKey: "paymentId",
        payloadKey: "payment_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/folios/transfer",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Transfer a folio balance via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "billing.folio.transfer",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/folios/close",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Close/settle a folio via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "billing.folio.close",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/payments/:paymentId/void",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Void a previously authorized payment via the Command Center.",
        params: tenantPaymentParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.payment.void",
        paramKey: "paymentId",
        payloadKey: "payment_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/cashier-sessions/open",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Open a cashier session via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "billing.cashier.open",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/cashier-sessions/close",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Close a cashier session via the Command Center.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: {
          202: commandAcceptedSchema,
        },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "billing.cashier.close",
      }),
  );

  app.get(
    "/v1/billing/*",
    {
      preHandler: tenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy nested billing routes to the billing service.",
        response: {
          200: jsonObjectSchema,
        },
      }),
    },
    proxyBilling,
  );
};
