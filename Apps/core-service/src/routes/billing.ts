import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { PaymentMethodEnum, PaymentStatusEnum, TransactionTypeEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { BillingPaymentSchema, listBillingPayments } from "../services/billing-service.js";

const BillingListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value || PaymentStatusEnum.options.map((status) => status.toLowerCase()).includes(value),
      { message: "Invalid payment status" },
    ),
  transaction_type: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        TransactionTypeEnum.options.map((transaction) => transaction.toLowerCase()).includes(value),
      { message: "Invalid transaction type" },
    ),
  payment_method: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value || PaymentMethodEnum.options.map((method) => method.toLowerCase()).includes(value),
      { message: "Invalid payment method" },
    ),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

type BillingListQuery = z.infer<typeof BillingListQuerySchema>;

const BillingListResponseSchema = z.array(BillingPaymentSchema);
const BillingListQueryJsonSchema = schemaFromZod(BillingListQuerySchema, "BillingPaymentsQuery");
const BillingListResponseJsonSchema = schemaFromZod(
  BillingListResponseSchema,
  "BillingPaymentsResponse",
);

const BILLING_TAG = "Billing";

export const registerBillingRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: BillingListQuery }>(
    "/v1/billing/payments",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as BillingListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "List billing payments with optional filters",
        querystring: BillingListQueryJsonSchema,
        response: {
          200: BillingListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, status, transaction_type, payment_method, limit } =
        BillingListQuerySchema.parse(request.query);

      const payments = await listBillingPayments({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        transactionType: transaction_type,
        paymentMethod: payment_method,
        limit,
      });

      return BillingListResponseSchema.parse(payments);
    },
  );
};
