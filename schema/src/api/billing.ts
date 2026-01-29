/**
 * DEV DOC
 * Module: api/billing.ts
 * Purpose: Billing API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

/**
 * Billing payment list item schema for API responses.
 * Includes display fields derived from enum values.
 */
export const BillingPaymentListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	reservation_id: uuid.optional(),
	confirmation_number: z.string().optional(),
	guest_id: uuid.optional(),
	guest_name: z.string().optional(),
	payment_reference: z.string(),
	external_transaction_id: z.string().optional(),
	transaction_type: z.string(),
	transaction_type_display: z.string(),
	payment_method: z.string(),
	payment_method_display: z.string(),
	status: z.string(),
	status_display: z.string(),
	amount: z.number(),
	currency: z.string(),
	processed_at: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
	version: z.string(),
	gateway_name: z.string().optional(),
	gateway_reference: z.string().optional(),
});

export type BillingPaymentListItem = z.infer<typeof BillingPaymentListItemSchema>;

/**
 * Billing payment list response schema.
 */
export const BillingPaymentListResponseSchema = z.object({
	data: z.array(BillingPaymentListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type BillingPaymentListResponse = z.infer<typeof BillingPaymentListResponseSchema>;
