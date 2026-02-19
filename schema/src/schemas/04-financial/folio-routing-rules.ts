/**
 * DEV DOC
 * Module: schemas/04-financial/folio-routing-rules.ts
 * Description: Folio Routing Rules Schema
 * Table: folio_routing_rules
 * Category: 04-financial
 * Primary exports: FolioRoutingRulesSchema, CreateFolioRoutingRulesSchema, UpdateFolioRoutingRulesSchema
 * @table folio_routing_rules
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * Folio Routing Rules Schema
 * Defines templates and active rules for distributing charges across multiple folios
 * (split billing: company pays room, guest pays incidentals, etc.)
 * @table folio_routing_rules
 * @category 04-financial
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/** How the charge is routed to the destination folio */
export const routingTypeEnum = z.enum([
	"FULL",
	"PERCENTAGE",
	"FIXED_AMOUNT",
	"REMAINDER",
]);
export type RoutingType = z.infer<typeof routingTypeEnum>;

/** High-level charge category for routing criteria */
export const chargeCategoryEnum = z.enum([
	"ACCOMMODATION",
	"FOOD_BEVERAGE",
	"SERVICES",
	"TAXES_FEES",
	"INCIDENTALS",
]);
export type ChargeCategory = z.infer<typeof chargeCategoryEnum>;

/** Destination folio type (used in templates) */
export const destinationFolioTypeEnum = z.enum([
	"GUEST",
	"MASTER",
	"CITY_LEDGER",
]);
export type DestinationFolioType = z.infer<typeof destinationFolioTypeEnum>;

/**
 * Complete Folio Routing Rules schema
 */
export const FolioRoutingRulesSchema = z.object({
	rule_id: uuid,
	tenant_id: uuid,
	property_id: uuid,

	// Rule Identity
	rule_name: z.string().max(200),
	rule_code: z.string().max(50).optional(),
	description: z.string().optional(),

	// Template vs Active
	is_template: z.boolean().default(true),
	template_id: uuid.optional(),

	// Source
	source_folio_id: uuid.optional(),
	source_reservation_id: uuid.optional(),

	// Destination
	destination_folio_id: uuid.optional(),
	destination_folio_type: destinationFolioTypeEnum.optional(),

	// Routing Criteria
	charge_code_pattern: z.string().max(100).optional(),
	transaction_type: z.string().max(50).optional(),
	charge_category: chargeCategoryEnum.optional(),
	min_amount: money.optional(),
	max_amount: money.optional(),

	// Routing Action
	routing_type: routingTypeEnum.default("FULL"),
	routing_percentage: z.number().min(0).max(100).optional(),
	routing_fixed_amount: money.optional(),

	// Priority
	priority: z.number().int().default(100),
	stop_on_match: z.boolean().default(true),

	// Schedule
	effective_from: z.coerce.date().optional(),
	effective_until: z.coerce.date().optional(),

	// Auto-apply
	auto_apply_to_group: z.boolean().default(false),
	auto_apply_to_company: z.boolean().default(false),

	// Associations
	company_id: uuid.optional(),
	group_booking_id: uuid.optional(),

	// Status
	is_active: z.boolean().default(true),

	// Audit
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),

	// Soft Delete
	is_deleted: z.boolean().default(false),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type FolioRoutingRules = z.infer<typeof FolioRoutingRulesSchema>;

/**
 * Schema for creating a new folio routing rule
 */
export const CreateFolioRoutingRulesSchema = FolioRoutingRulesSchema.omit({
	rule_id: true,
	created_at: true,
	updated_at: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
});

export type CreateFolioRoutingRules = z.infer<
	typeof CreateFolioRoutingRulesSchema
>;

/**
 * Schema for updating a folio routing rule
 */
export const UpdateFolioRoutingRulesSchema =
	FolioRoutingRulesSchema.partial().omit({
		rule_id: true,
		tenant_id: true,
		created_at: true,
	});

export type UpdateFolioRoutingRules = z.infer<
	typeof UpdateFolioRoutingRulesSchema
>;
