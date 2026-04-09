/**
 * Billing proxy and command routes.
 *
 * Read endpoints (GET) are proxied directly to the billing service.
 * Write endpoints (POST) dispatch commands through the Command Center
 * pipeline for asynchronous processing (payment capture, refund,
 * invoice creation, folio transfer, cashier session management).
 *
 * @module billing-routes
 */
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
  tenantChargeParamsSchema,
  tenantFolioParamsSchema,
  tenantInvoiceParamsSchema,
  tenantPaymentParamsSchema,
  tenantRefundParamsSchema,
  tenantReservationParamsSchema,
  tenantTaxConfigParamsSchema,
} from "./schemas.js";

/** Register billing read-proxy and command-dispatch routes on the gateway. */
export const registerBillingRoutes = (app: FastifyInstance): void => {
  const proxyBilling = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.billingServiceUrl);

  const proxyCashier = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.billingServiceUrl);

  const proxyAccounts = async (request: FastifyRequest, reply: FastifyReply) =>
    proxyRequest(request, reply, serviceTargets.billingServiceUrl);

  const proxyFinanceAdmin = async (request: FastifyRequest, reply: FastifyReply) =>
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

  const financeTenantScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
    minRole: "ADMIN",
    requiredModules: "finance-automation",
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
    "/v1/tenants/:tenantId/billing/charges/:postingId/void",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Void a charge posting via the Command Center.",
        params: tenantChargeParamsSchema,
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
        commandName: "billing.charge.void",
        paramKey: "postingId",
        payloadKey: "posting_id",
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

  // ============================================================================
  // FOLIO & INVOICE INDUSTRY-STANDARD ROUTES (standalone folios, void, credit notes)
  // ============================================================================

  app.post(
    "/v1/tenants/:tenantId/billing/folios",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Create a standalone folio (house account, city ledger, walk-in).",
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
        commandName: "billing.folio.create",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/folios/:folioId/split",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Split charges within a folio via the Command Center.",
        params: tenantFolioParamsSchema,
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
        commandName: "billing.folio.split",
        paramKey: "folioId",
        payloadKey: "folio_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/folios/:folioId/windows",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Create a folio window (split billing by date range).",
        params: tenantFolioParamsSchema,
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
        commandName: "billing.folio_window.create",
        paramKey: "folioId",
        payloadKey: "folio_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/invoices/:invoiceId/finalize",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Finalize an invoice, locking it from further edits.",
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
        commandName: "billing.invoice.finalize",
        paramKey: "invoiceId",
        payloadKey: "invoice_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/invoices/:invoiceId/void",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Void a DRAFT invoice. Issued invoices require a credit note instead.",
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
        commandName: "billing.invoice.void",
        paramKey: "invoiceId",
        payloadKey: "invoice_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/invoices/:invoiceId/credit-note",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Create a credit note against a finalized/issued invoice.",
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
        commandName: "billing.credit_note.create",
        paramKey: "invoiceId",
        payloadKey: "original_invoice_id",
      }),
  );

  // ============================================================================
  // CASHIER SESSION PROXY (cashier-sessions → billing-service :3025)
  // ============================================================================

  app.get(
    "/v1/billing/cashier-sessions",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy cashier session list to the cashier service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCashier,
  );

  app.get(
    "/v1/billing/cashier-sessions/:sessionId",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy cashier session detail to the cashier service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCashier,
  );

  app.get(
    "/v1/billing/cashier-sessions/:sessionId/shift-summary",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy shift summary to the cashier service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyCashier,
  );

  // ============================================================================
  // ACCOUNTS SERVICE PROXY (invoices, AR → accounts-service :3085)
  // ============================================================================

  app.get(
    "/v1/billing/invoices",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy invoice list to the accounts service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyAccounts,
  );

  app.get(
    "/v1/billing/invoices/:invoiceId",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy invoice detail to the accounts service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyAccounts,
  );

  app.get(
    "/v1/billing/accounts-receivable",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy AR list to the accounts service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyAccounts,
  );

  app.get(
    "/v1/billing/accounts-receivable/aging-summary",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy AR aging summary to the accounts service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyAccounts,
  );

  app.get(
    "/v1/billing/accounts-receivable/:arId",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy AR detail to the accounts service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyAccounts,
  );

  // ============================================================================
  // FINANCE ADMIN SERVICE PROXY (tax configs, reports → finance-admin-service :3090)
  // ============================================================================

  app.get(
    "/v1/billing/tax-configurations",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy tax configuration list to the finance admin service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyFinanceAdmin,
  );

  app.get(
    "/v1/billing/tax-configurations/:taxConfigId",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy tax configuration detail to the finance admin service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyFinanceAdmin,
  );

  app.get(
    "/v1/billing/reports/trial-balance",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy trial balance report to the finance admin service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyFinanceAdmin,
  );

  app.get(
    "/v1/billing/reports/departmental-revenue",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy departmental revenue report to the finance admin service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyFinanceAdmin,
  );

  app.get(
    "/v1/billing/reports/tax-summary",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy tax summary report to the finance admin service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyFinanceAdmin,
  );

  app.get(
    "/v1/billing/reports/commissions",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy commission report to the finance admin service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyFinanceAdmin,
  );

  // ============================================================================
  // CASHIER HANDOVER (shift transition)
  // ============================================================================

  app.post(
    "/v1/tenants/:tenantId/billing/cashier-sessions/handover",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Handover a cashier session to the next shift atomically.",
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
        commandName: "billing.cashier.handover",
      }),
  );

  // ============================================================================
  // TAX CONFIGURATION COMMANDS (CRUD)
  // ============================================================================

  app.post(
    "/v1/tenants/:tenantId/billing/tax-configurations",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Create a tax configuration via the Command Center.",
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
        commandName: "billing.tax_config.create",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/tax-configurations/:taxConfigId/update",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Update a tax configuration via the Command Center.",
        params: tenantTaxConfigParamsSchema,
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
        commandName: "billing.tax_config.update",
        paramKey: "taxConfigId",
        payloadKey: "tax_config_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/tax-configurations/:taxConfigId/delete",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Delete a tax configuration via the Command Center.",
        params: tenantTaxConfigParamsSchema,
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
        commandName: "billing.tax_config.delete",
        paramKey: "taxConfigId",
        payloadKey: "tax_config_id",
      }),
  );

  // ============================================================================
  // FOLIO LIFECYCLE COMMANDS (reopen, merge)
  // ============================================================================

  app.post(
    "/v1/tenants/:tenantId/billing/folios/:folioId/reopen",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Reopen a settled or closed folio for further postings.",
        params: tenantFolioParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.folio.reopen",
        paramKey: "folioId",
        payloadKey: "folio_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/folios/merge",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Merge a source folio into a target folio.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "billing.folio.merge",
      }),
  );

  // ============================================================================
  // INVOICE LIFECYCLE COMMANDS (reopen)
  // ============================================================================

  app.post(
    "/v1/tenants/:tenantId/billing/invoices/:invoiceId/reopen",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Reopen a finalized invoice as a new draft correction.",
        params: tenantInvoiceParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.invoice.reopen",
        paramKey: "invoiceId",
        payloadKey: "invoice_id",
      }),
  );

  // ============================================================================
  // CHARGEBACK STATUS COMMAND
  // ============================================================================

  app.post(
    "/v1/tenants/:tenantId/billing/chargebacks/:refundId/status",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary:
          "Advance a chargeback through its state machine (RECEIVED → EVIDENCE_SUBMITTED → WON|LOST).",
        params: tenantRefundParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.chargeback.update_status",
        paramKey: "refundId",
        payloadKey: "refund_id",
      }),
  );

  // ============================================================================
  // RESERVATION CHARGE COMMANDS (no-show, late checkout, cancellation penalty)
  // ============================================================================

  app.post(
    "/v1/tenants/:tenantId/billing/reservations/:reservationId/no-show-charge",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Post a no-show penalty charge to the reservation folio.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.no_show.charge",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/reservations/:reservationId/late-checkout-charge",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Post a late checkout fee to the reservation folio (tier-based calculation).",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.late_checkout.charge",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  app.post(
    "/v1/tenants/:tenantId/billing/reservations/:reservationId/cancellation-penalty",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Post a cancellation penalty charge per rate plan policy.",
        params: tenantReservationParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.cancellation.penalty",
        paramKey: "reservationId",
        payloadKey: "reservation_id",
      }),
  );

  // ============================================================================
  // TAX EXEMPTION COMMAND
  // ============================================================================

  app.post(
    "/v1/tenants/:tenantId/billing/folios/:folioId/tax-exemption",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Apply a tax exemption certificate to an open folio.",
        params: tenantFolioParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithParamId({
        request,
        reply,
        commandName: "billing.tax_exemption.apply",
        paramKey: "folioId",
        payloadKey: "folio_id",
      }),
  );

  // ============================================================================
  // COMP POSTING COMMAND
  // ============================================================================

  app.post(
    "/v1/tenants/:tenantId/billing/charges/comp",
    {
      preHandler: tenantScopeFromParams,
      schema: buildRouteSchema({
        tag: BILLING_COMMAND_TAG,
        summary: "Post a complimentary charge to a folio for budget tracking.",
        params: reservationParamsSchema,
        body: jsonObjectSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    (request, reply) =>
      forwardCommandWithTenant({
        request,
        reply,
        commandName: "billing.comp.post",
      }),
  );

  // ============================================================================
  // FOLIO ROUTING RULES PROXY (routing-rules → billing-service :3025)
  // ============================================================================

  app.get(
    "/v1/billing/routing-rules",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy routing rules list to the billing service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyBilling,
  );

  app.get(
    "/v1/billing/routing-rules/templates",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy routing rule templates list to the billing service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyBilling,
  );

  app.get(
    "/v1/billing/routing-rules/:ruleId",
    {
      preHandler: financeTenantScopeFromQuery,
      schema: buildRouteSchema({
        tag: BILLING_PROXY_TAG,
        summary: "Proxy routing rule detail to the billing service.",
        response: { 200: jsonObjectSchema },
      }),
    },
    proxyBilling,
  );

  // ============================================================================
  // BILLING SERVICE CATCH-ALL (remaining routes → billing-service :3025)
  // ============================================================================

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
