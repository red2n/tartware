/**
 * DEV DOC
 * Module: events/commands/billing.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { PaymentMethodEnum } from "../../shared/enums.js";

export const BillingPaymentCaptureCommandSchema = z.object({
	payment_reference: z.string().trim().min(3).max(100),
	property_id: z.string().uuid(),
	reservation_id: z.string().uuid(),
	guest_id: z.string().uuid(),
	amount: z.coerce.number().positive(),
	currency: z.string().length(3).optional(),
	payment_method: PaymentMethodEnum,
	gateway: z
		.object({
			name: z.string().max(100).optional(),
			reference: z.string().max(150).optional(),
			response: z.record(z.unknown()).optional(),
		})
		.optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type BillingPaymentCaptureCommand = z.infer<
	typeof BillingPaymentCaptureCommandSchema
>;

export const BillingPaymentRefundCommandSchema = z
	.object({
		payment_id: z.string().uuid().optional(),
		payment_reference: z.string().trim().max(100).optional(),
		property_id: z.string().uuid(),
		reservation_id: z.string().uuid(),
		guest_id: z.string().uuid(),
		amount: z.coerce.number().positive(),
		currency: z.string().length(3).optional(),
		reason: z.string().max(500).optional(),
		refund_reference: z.string().trim().max(120).optional(),
		payment_method: PaymentMethodEnum.optional(),
	})
	.refine(
		(value) => Boolean(value.payment_id || value.payment_reference),
		"payment_id or payment_reference is required",
	);

export type BillingPaymentRefundCommand = z.infer<
	typeof BillingPaymentRefundCommandSchema
>;
