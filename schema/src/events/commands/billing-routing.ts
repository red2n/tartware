/**
 * Billing command schemas — Routing Rules domain
 * Covers folio routing rule create, update, delete, and clone-from-template.
 * @category commands
 */

import { z } from "zod";

/**
 * Create a new folio routing rule (template or active).
 * Templates are reusable blueprints; active rules are bound to specific folios.
 */
export const BillingRoutingRuleCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	rule_name: z.string().min(1).max(200),
	rule_code: z.string().max(50).optional(),
	description: z.string().max(2000).optional(),
	is_template: z.boolean().default(false),
	/** Source folio — required for active rules, omitted for templates. */
	source_folio_id: z.string().uuid().optional(),
	source_reservation_id: z.string().uuid().optional(),
	/** Destination folio — required for active rules. */
	destination_folio_id: z.string().uuid().optional(),
	destination_folio_type: z
		.enum(["GUEST", "MASTER", "CITY_LEDGER", "INCIDENTAL", "HOUSE_ACCOUNT"])
		.optional(),
	/** Charge code pattern: exact ("ROOM"), wildcard ("F&B*"), or CSV ("ROOM,SPA"). */
	charge_code_pattern: z.string().max(100).optional(),
	transaction_type: z.string().max(50).optional(),
	charge_category: z
		.enum([
			"ACCOMMODATION",
			"FOOD_BEVERAGE",
			"SERVICES",
			"TAXES_FEES",
			"INCIDENTALS",
		])
		.optional(),
	min_amount: z.coerce.number().min(0).optional(),
	max_amount: z.coerce.number().min(0).optional(),
	routing_type: z.enum(["FULL", "PERCENTAGE", "FIXED_AMOUNT", "REMAINDER"]).default("FULL"),
	routing_percentage: z.coerce.number().min(0).max(100).optional(),
	routing_fixed_amount: z.coerce.number().min(0).optional(),
	priority: z.coerce.number().int().min(0).default(100),
	stop_on_match: z.boolean().default(true),
	effective_from: z.coerce.date().optional(),
	effective_until: z.coerce.date().optional(),
	auto_apply_to_group: z.boolean().default(false),
	auto_apply_to_company: z.boolean().default(false),
	company_id: z.string().uuid().optional(),
	group_booking_id: z.string().uuid().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingRoutingRuleCreateCommand = z.infer<
	typeof BillingRoutingRuleCreateCommandSchema
>;

/**
 * Update an existing routing rule's criteria, priority, or routing type.
 */
export const BillingRoutingRuleUpdateCommandSchema = z.object({
	rule_id: z.string().uuid(),
	property_id: z.string().uuid(),
	rule_name: z.string().min(1).max(200).optional(),
	description: z.string().max(2000).optional(),
	destination_folio_id: z.string().uuid().optional(),
	destination_folio_type: z
		.enum(["GUEST", "MASTER", "CITY_LEDGER", "INCIDENTAL", "HOUSE_ACCOUNT"])
		.optional(),
	charge_code_pattern: z.string().max(100).optional(),
	transaction_type: z.string().max(50).optional(),
	charge_category: z
		.enum([
			"ACCOMMODATION",
			"FOOD_BEVERAGE",
			"SERVICES",
			"TAXES_FEES",
			"INCIDENTALS",
		])
		.optional(),
	min_amount: z.coerce.number().min(0).optional(),
	max_amount: z.coerce.number().min(0).optional(),
	routing_type: z.enum(["FULL", "PERCENTAGE", "FIXED_AMOUNT", "REMAINDER"]).optional(),
	routing_percentage: z.coerce.number().min(0).max(100).optional(),
	routing_fixed_amount: z.coerce.number().min(0).optional(),
	priority: z.coerce.number().int().min(0).optional(),
	stop_on_match: z.boolean().optional(),
	effective_from: z.coerce.date().optional(),
	effective_until: z.coerce.date().optional(),
	is_active: z.boolean().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingRoutingRuleUpdateCommand = z.infer<
	typeof BillingRoutingRuleUpdateCommandSchema
>;

/**
 * Soft-delete a routing rule.
 */
export const BillingRoutingRuleDeleteCommandSchema = z.object({
	rule_id: z.string().uuid(),
	property_id: z.string().uuid(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingRoutingRuleDeleteCommand = z.infer<
	typeof BillingRoutingRuleDeleteCommandSchema
>;

/**
 * Clone a template rule into active rules bound to a specific folio pair.
 * Copies template fields, sets is_template=false, and binds source + destination.
 */
export const BillingRoutingRuleCloneTemplateCommandSchema = z.object({
	template_id: z.string().uuid(),
	property_id: z.string().uuid(),
	source_folio_id: z.string().uuid(),
	destination_folio_id: z.string().uuid(),
	/** Override priority from template. */
	priority: z.coerce.number().int().min(0).optional(),
	/** Override effective dates from template. */
	effective_from: z.coerce.date().optional(),
	effective_until: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type BillingRoutingRuleCloneTemplateCommand = z.infer<
	typeof BillingRoutingRuleCloneTemplateCommandSchema
>;
