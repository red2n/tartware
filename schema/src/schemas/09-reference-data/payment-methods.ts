/**
 * DEV DOC
 * Module: schemas/09-reference-data/payment-methods.ts
 * Description: PaymentMethods Schema - Dynamic payment method lookup table
 * Table: payment_methods
 * Category: 09-reference-data
 * Primary exports: PaymentMethodsSchema, CreatePaymentMethodsSchema, UpdatePaymentMethodsSchema
 * @table payment_methods
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * PaymentMethods Schema
 * Configurable payment method codes (CASH, CREDIT_CARD, etc.)
 * replacing hardcoded ENUM. Supports card brands, processing fees,
 * gateway integration, and PCI-DSS compliance requirements.
 *
 * @table payment_methods
 * @category 09-reference-data
 * @synchronized 2026-02-05
 */

import { z } from "zod";

import { uuid, money, percentage, currencyCode } from "../../shared/base-schemas.js";

/**
 * Payment method category enum
 */
export const PaymentMethodCategoryEnum = z.enum([
	"CASH",
	"CREDIT_CARD",
	"DEBIT_CARD",
	"BANK",
	"CHECK",
	"DIGITAL",
	"CRYPTO",
	"VOUCHER",
	"ACCOUNT",
	"OTHER",
]);

export type PaymentMethodCategory = z.infer<typeof PaymentMethodCategoryEnum>;

/**
 * Complete PaymentMethods schema
 */
export const PaymentMethodsSchema = z.object({
	// Primary Key
	method_id: uuid,

	// Multi-tenancy (NULL tenant_id = system default)
	tenant_id: uuid.optional().nullable(),
	property_id: uuid.optional().nullable(),

	// Payment Method Identification
	code: z
		.string()
		.min(1)
		.max(30)
		.regex(/^[A-Z0-9_]{1,30}$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(1).max(100),
	description: z.string().optional().nullable(),

	// Classification
	category: PaymentMethodCategoryEnum,

	// Processing Behavior
	is_electronic: z.boolean().default(false),
	is_guaranteed: z.boolean().default(false),
	is_prepayment: z.boolean().default(false),
	is_refundable: z.boolean().default(true),
	is_tokenizable: z.boolean().default(false),
	requires_authorization: z.boolean().default(false),

	// Card-Specific (for credit/debit)
	card_brand: z.string().max(20).optional().nullable(),
	card_type: z.string().max(20).optional().nullable(),
	bin_range_start: z.string().max(6).optional().nullable(),
	bin_range_end: z.string().max(6).optional().nullable(),

	// Settlement
	settlement_days: z.number().int().min(0).default(0),
	default_fee_pct: percentage.optional().nullable(),
	default_fee_fixed: money.optional().nullable(),
	currency_code: currencyCode.default("USD"),

	// Limits
	min_amount: money.default(0),
	max_amount: money.optional().nullable(),
	requires_id_verification: z.boolean().default(false),
	requires_signature: z.boolean().default(false),

	// Integration
	gateway_code: z.string().max(50).optional().nullable(),
	terminal_type: z.string().max(30).optional().nullable(),

	// Mapping to Legacy Enum
	legacy_enum_value: z.string().max(50).optional().nullable(),

	// Display & UI
	display_order: z.number().int().default(0),
	color_code: z.string().max(7).optional().nullable(),
	icon: z.string().max(50).optional().nullable(),
	logo_url: z.string().max(255).optional().nullable(),

	// System vs Custom
	is_system: z.boolean().default(false),
	is_active: z.boolean().default(true),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),

	// Soft Delete
	deleted_at: z.coerce.date().optional().nullable(),
	deleted_by: uuid.optional().nullable(),
});

export type PaymentMethods = z.infer<typeof PaymentMethodsSchema>;

/**
 * Schema for creating a new payment method
 */
export const CreatePaymentMethodsSchema = PaymentMethodsSchema.omit({
	method_id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
	deleted_by: true,
}).extend({
	code: z
		.string()
		.min(1)
		.max(30)
		.regex(/^[A-Z0-9_]{1,30}$/, {
			message: "Code must be uppercase alphanumeric with underscores",
		}),
	name: z.string().min(1).max(100),
	category: PaymentMethodCategoryEnum,
});

export type CreatePaymentMethods = z.infer<typeof CreatePaymentMethodsSchema>;

/**
 * Schema for updating a payment method
 */
export const UpdatePaymentMethodsSchema = PaymentMethodsSchema.partial().omit({
	method_id: true,
	created_at: true,
	created_by: true,
	is_system: true,
});

export type UpdatePaymentMethods = z.infer<typeof UpdatePaymentMethodsSchema>;
