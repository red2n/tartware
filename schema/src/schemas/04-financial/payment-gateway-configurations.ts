/**
 * DEV DOC
 * Module: schemas/04-financial/payment-gateway-configurations.ts
 * Description: Payment gateway configuration schema — stores processor credentials,
 *   integration settings, 3DS/tokenization config, and processing rules per tenant/property.
 * Table: payment_gateway_configurations
 * Category: 04-financial
 * Primary exports: PaymentGatewayConfigurationsSchema, CreatePaymentGatewayConfigurationsSchema, UpdatePaymentGatewayConfigurationsSchema
 * @table payment_gateway_configurations
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * Payment Gateway Configurations Schema
 * Per-tenant payment processor credentials and integration settings.
 *
 * @table payment_gateway_configurations
 * @category 04-financial
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

// ─── Full Row Schema ─────────────────────────────────────────────────────────

export const PaymentGatewayConfigurationsSchema = z.object({
	config_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional().nullable(),

	// Gateway Provider
	gateway_provider: z.string().min(1).max(50),
	gateway_label: z.string().min(1).max(200),
	gateway_environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),

	// Credentials (vault references)
	api_key_ref: z.string().max(500).optional().nullable(),
	api_secret_ref: z.string().max(500).optional().nullable(),
	merchant_id: z.string().max(200).optional().nullable(),
	webhook_secret_ref: z.string().max(500).optional().nullable(),

	// Processing Configuration
	supported_currencies: z.array(z.string().max(3)).default(["USD"]),
	supported_card_brands: z
		.array(z.string().max(20))
		.default(["VISA", "MASTERCARD", "AMEX"]),
	supported_payment_methods: z
		.array(z.string().max(50))
		.default(["CREDIT_CARD"]),

	// 3D Secure
	three_ds_enabled: z.boolean().default(true),
	three_ds_enforce_on_high_risk: z.boolean().default(true),

	// Tokenization
	tokenization_enabled: z.boolean().default(true),
	tokenization_provider: z.string().max(50).optional().nullable(),

	// Retry & Timeout
	retry_attempts: z.number().int().default(3),
	retry_interval_minutes: z.number().int().default(15),
	request_timeout_ms: z.number().int().default(30000),

	// Processing Limits
	min_transaction_amount: money.default(0.5),
	max_transaction_amount: money.default(99999.99),
	daily_transaction_limit: money.optional().nullable(),

	// Surcharge
	surcharge_enabled: z.boolean().default(false),
	surcharge_percent: z.number().optional().nullable(),
	surcharge_flat_amount: money.optional().nullable(),

	// Webhook
	webhook_url: z.string().max(500).optional().nullable(),
	webhook_events: z
		.array(z.string().max(100))
		.default(["payment.completed", "payment.failed", "refund.completed"]),

	// Status
	is_active: z.boolean().default(true),
	is_primary: z.boolean().default(false),

	// Notes
	notes: z.string().optional().nullable(),
	metadata: z.record(z.unknown()).optional(),

	// Audit
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),

	// Soft Delete
	is_deleted: z.boolean().default(false),
	deleted_at: z.coerce.date().optional().nullable(),
	deleted_by: uuid.optional().nullable(),
});

export type PaymentGatewayConfigurations = z.infer<
	typeof PaymentGatewayConfigurationsSchema
>;

// ─── Create Schema ───────────────────────────────────────────────────────────

export const CreatePaymentGatewayConfigurationsSchema =
	PaymentGatewayConfigurationsSchema.omit({
		config_id: true,
		created_at: true,
		updated_at: true,
		deleted_at: true,
		deleted_by: true,
		is_deleted: true,
	});

export type CreatePaymentGatewayConfigurations = z.infer<
	typeof CreatePaymentGatewayConfigurationsSchema
>;

// ─── Update Schema ───────────────────────────────────────────────────────────

export const UpdatePaymentGatewayConfigurationsSchema =
	PaymentGatewayConfigurationsSchema.partial().omit({
		config_id: true,
		tenant_id: true,
		created_at: true,
		created_by: true,
	});

export type UpdatePaymentGatewayConfigurations = z.infer<
	typeof UpdatePaymentGatewayConfigurationsSchema
>;
