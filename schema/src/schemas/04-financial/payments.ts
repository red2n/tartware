/**
 * DEV DOC
 * Module: schemas/04-financial/payments.ts
 * Description: Payments Schema
 * Table: payments
 * Category: 04-financial
 * Primary exports: PaymentsSchema, CreatePaymentsSchema, UpdatePaymentsSchema
 * @table payments
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * Payments Schema
 * @table payments
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";
import {
	TransactionTypeEnum,
	PaymentMethodEnum,
	PaymentStatusEnum,
} from "../../shared/enums.js";

/**
 * Complete Payments schema
 */
export const PaymentsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	reservation_id: uuid,
	guest_id: uuid,
	payment_reference: z.string(),
	external_transaction_id: z.string().optional(),
	transaction_type: TransactionTypeEnum,
	payment_method: PaymentMethodEnum,
	payment_token_id: uuid.optional(),
	amount: money,
	currency: z.string().optional(),
	exchange_rate: money.optional(),
	base_amount: money.optional(),
	base_currency: z.string().optional(),
	status: PaymentStatusEnum,
	gateway_name: z.string().optional(),
	gateway_reference: z.string().optional(),
	gateway_response: z.record(z.unknown()).optional(),
	authorization_code: z.string().optional(),
	capture_reference: z.string().optional(),
	three_ds_version: z.string().optional(),
	three_ds_result: z.string().optional(),
	card_type: z.string().optional(),
	card_last4: z.string().optional(),
	card_holder_name: z.string().optional(),
	card_fingerprint: z.string().optional(),
	processed_at: z.coerce.date().optional(),
	processed_by: z.string().optional(),
	refund_amount: money.optional(),
	refund_date: z.coerce.date().optional(),
	refund_reason: z.string().optional(),
	refunded_by: z.string().optional(),
	notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().optional(),
	version: z.bigint().optional(),
});

export type Payments = z.infer<typeof PaymentsSchema>;

/**
 * Schema for creating a new payments
 */
export const CreatePaymentsSchema = PaymentsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreatePayments = z.infer<typeof CreatePaymentsSchema>;

/**
 * Schema for updating a payments
 */
export const UpdatePaymentsSchema = PaymentsSchema.partial();

export type UpdatePayments = z.infer<typeof UpdatePaymentsSchema>;
