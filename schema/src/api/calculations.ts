/**
 * DEV DOC
 * Module: api/calculations.ts
 * Purpose: Calculation engine API input/output schemas
 * Ownership: Schema package
 *
 * Stateless financial calculation schemas used by calculation-service.
 * All formulas reference CORE.md sections.
 */

import { z } from "zod";

// =====================================================
// SHARED PRIMITIVES
// =====================================================

/** Monetary amount (signed — allows negatives for credits/refunds) */
const amt = z.number().describe("Monetary amount");
const posAmt = z.number().nonnegative().describe("Non-negative monetary amount");
const pct = z.number().min(0).max(100).describe("Percentage (0-100)");
const posInt = z.number().int().nonnegative().describe("Non-negative integer");

// =====================================================
// TAX CALCULATION SCHEMAS (CORE.md §1)
// =====================================================

export const TaxableAmountInputSchema = z.object({
	amount: posAmt,
	quantity: posInt,
	negate: z.boolean().default(false).describe("Negate for refund/allowance types"),
});
export type TaxableAmountInput = z.infer<typeof TaxableAmountInputSchema>;

export const TaxableAmountOutputSchema = z.object({
	taxable_amount: amt,
	negated: z.boolean(),
	formula: z.string(),
});
export type TaxableAmountOutput = z.infer<typeof TaxableAmountOutputSchema>;

export const ReverseTaxInputSchema = z.object({
	taxable_amount: posAmt,
	quantity: posInt.min(1),
	exempted_tax_amount: posAmt.default(0),
});
export type ReverseTaxInput = z.infer<typeof ReverseTaxInputSchema>;

export const ReverseTaxOutputSchema = z.object({
	unit_amount: amt,
	unit_amount_after_exemption: amt,
	formula: z.string(),
});
export type ReverseTaxOutput = z.infer<typeof ReverseTaxOutputSchema>;

export const TaxRuleInputSchema = z.object({
	code: z.string(),
	rate: pct,
	is_compound: z.boolean().default(false),
	compound_order: z.number().int().optional(),
});

export const InclusiveTaxExtractInputSchema = z.object({
	gross_amount: posAmt,
	tax_rules: z.array(TaxRuleInputSchema).min(1),
});
export type InclusiveTaxExtractInput = z.infer<typeof InclusiveTaxExtractInputSchema>;

export const InclusiveTaxExtractOutputSchema = z.object({
	net_amount: amt,
	taxes: z.array(z.object({ code: z.string(), amount: amt })),
	total_tax: amt,
	formula: z.string(),
});
export type InclusiveTaxExtractOutput = z.infer<typeof InclusiveTaxExtractOutputSchema>;

export const BulkTaxLineItemSchema = z.object({
	amount: posAmt,
	quantity: posInt,
	charge_code: z.string(),
});

export const BulkTaxInputSchema = z.object({
	line_items: z.array(BulkTaxLineItemSchema).min(1),
	tax_rules: z.array(TaxRuleInputSchema).min(1),
});
export type BulkTaxInput = z.infer<typeof BulkTaxInputSchema>;

export const BulkTaxOutputSchema = z.object({
	line_items: z.array(z.object({
		charge_code: z.string(),
		subtotal: amt,
		taxes: z.array(z.object({ code: z.string(), amount: amt })),
		total: amt,
	})),
	grand_total: amt,
	total_tax: amt,
});
export type BulkTaxOutput = z.infer<typeof BulkTaxOutputSchema>;

// =====================================================
// RATE & PRICING SCHEMAS (CORE.md §2)
// =====================================================

export const RateAdjustmentTypeEnum = z.enum(["UNIT", "ADJUST_UNIT", "ADJUST_PERCENT"]);

export const RateOverrideInputSchema = z.object({
	base_price: posAmt,
	adjustment_type: RateAdjustmentTypeEnum,
	amount: amt,
});
export type RateOverrideInput = z.infer<typeof RateOverrideInputSchema>;

export const RateOverrideOutputSchema = z.object({
	rate: amt,
	formula: z.string(),
});
export type RateOverrideOutput = z.infer<typeof RateOverrideOutputSchema>;

export const AgeCategoryInputSchema = z.object({
	count: posInt,
	included: posInt,
	charge: posAmt,
});

export const OccupancyRateInputSchema = z.object({
	pre_occupancy_rate: posAmt,
	adults: posInt,
	children: posInt.default(0),
	adults_included: posInt,
	children_included: posInt.default(0),
	extra_adult_charge: posAmt.default(0),
	extra_child_charge: posAmt.default(0),
	age_categories: z.array(AgeCategoryInputSchema).optional(),
});
export type OccupancyRateInput = z.infer<typeof OccupancyRateInputSchema>;

export const OccupancyRateOutputSchema = z.object({
	total_rate: amt,
	occupancy_surcharge: amt,
	breakdown: z.record(z.number()),
});
export type OccupancyRateOutput = z.infer<typeof OccupancyRateOutputSchema>;

export const PackageComponentSchema = z.object({ amount: posAmt });

export const PackageRateInputSchema = z.object({
	base_rate: posAmt,
	inclusive_components: z.array(PackageComponentSchema).default([]),
	exclusive_components: z.array(PackageComponentSchema).default([]),
});
export type PackageRateInput = z.infer<typeof PackageRateInputSchema>;

export const PackageRateOutputSchema = z.object({
	room_rate: amt,
	total_rate: amt,
	inclusive_total: amt,
	exclusive_total: amt,
});
export type PackageRateOutput = z.infer<typeof PackageRateOutputSchema>;

export const QuoteInputSchema = z.object({
	nightly_rates: z.array(posAmt).min(1),
	components: z.array(posAmt).default([]),
	recurring_charges: z.array(posAmt).default([]),
	tax_rate: pct,
	offer_discount: posAmt.default(0),
	routed_amount: posAmt.default(0),
});
export type QuoteInput = z.infer<typeof QuoteInputSchema>;

export const QuoteOutputSchema = z.object({
	room_charge_total: amt,
	component_total: amt,
	recurring_total: amt,
	subtotal: amt,
	tax_total: amt,
	offer_discount: amt,
	routed_amount: amt,
	quote_grand_total: amt,
});
export type QuoteOutput = z.infer<typeof QuoteOutputSchema>;

// =====================================================
// REVENUE KPI SCHEMAS (CORE.md §4 + Industry Gaps)
// =====================================================

export const KpiDashboardInputSchema = z.object({
	room_revenue: posAmt,
	total_revenue: posAmt,
	net_revenue: posAmt.optional(),
	rooms_sold: posInt,
	available_rooms: posInt.min(1),
	comp_rooms: posInt.default(0),
	gross_operating_profit: posAmt.optional(),
	compset: z.object({
		occupancy: z.number().min(0).max(100),
		adr: posAmt,
		revpar: posAmt,
	}).optional(),
});
export type KpiDashboardInput = z.infer<typeof KpiDashboardInputSchema>;

export const CompetitiveIndexSchema = z.object({
	value: z.number(),
	label: z.string(),
	outperforming: z.boolean(),
});

export const KpiDashboardOutputSchema = z.object({
	adr: amt,
	revpar: amt,
	trevpar: amt,
	nrevpar: amt.optional(),
	goppar: amt.optional(),
	occupancy_percent: z.number(),
	avg_revenue_per_room: amt,
	competitive_indices: z.object({
		occupancy_index: CompetitiveIndexSchema,
		ari: CompetitiveIndexSchema,
		rgi: CompetitiveIndexSchema,
	}).optional(),
});
export type KpiDashboardOutput = z.infer<typeof KpiDashboardOutputSchema>;

// =====================================================
// FOLIO & BALANCE SCHEMAS (CORE.md §3)
// =====================================================

export const FolioLineItemInputSchema = z.object({
	amount: amt,
	quantity: posInt,
	is_reverse_tax: z.boolean().default(false),
	reverse_tax_total: amt.optional(),
});

export const FolioBalanceInputSchema = z.object({
	line_items: z.array(FolioLineItemInputSchema).min(1),
});
export type FolioBalanceInput = z.infer<typeof FolioBalanceInputSchema>;

export const FolioBalanceOutputSchema = z.object({
	balance: amt,
	line_count: posInt,
});
export type FolioBalanceOutput = z.infer<typeof FolioBalanceOutputSchema>;

export const CreditRemainingInputSchema = z.object({
	credit_limit: posAmt,
	account_balance: posAmt,
});
export type CreditRemainingInput = z.infer<typeof CreditRemainingInputSchema>;

export const CreditRemainingOutputSchema = z.object({
	remaining_credit: amt,
	utilization_percent: z.number(),
});
export type CreditRemainingOutput = z.infer<typeof CreditRemainingOutputSchema>;

export const ArBreakdownInputSchema = z.object({
	aging_buckets: z.array(posAmt),
	account_balance_total: posAmt,
	deposit_balance: posAmt.default(0),
	credit_limit: posAmt,
});
export type ArBreakdownInput = z.infer<typeof ArBreakdownInputSchema>;

export const ArBreakdownOutputSchema = z.object({
	invoice_total: amt,
	uninvoiced_total: amt,
	balance: amt,
	credit_limit_balance: amt,
	available_credit: amt,
});
export type ArBreakdownOutput = z.infer<typeof ArBreakdownOutputSchema>;

export const EstimatedCheckoutInputSchema = z.object({
	posted_charges: posAmt,
	future_charges: posAmt,
	posted_taxes: posAmt,
	future_taxes: posAmt,
	posted_payments: amt.describe("Negative for payments received"),
	stay_length: posInt.min(1),
});
export type EstimatedCheckoutInput = z.infer<typeof EstimatedCheckoutInputSchema>;

export const EstimatedCheckoutOutputSchema = z.object({
	estimated_charges: amt,
	estimated_taxes: amt,
	estimated_total: amt,
	avg_nightly_rate: amt,
	estimated_at_checkout: amt,
});
export type EstimatedCheckoutOutput = z.infer<typeof EstimatedCheckoutOutputSchema>;

// =====================================================
// SPLIT CALCULATION SCHEMAS (CORE.md §5)
// =====================================================

export const SplitByReservationInputSchema = z.object({
	total: posAmt,
	reservation_count: posInt.min(2),
});
export type SplitByReservationInput = z.infer<typeof SplitByReservationInputSchema>;

export const SplitByReservationOutputSchema = z.object({
	primary_share: amt,
	secondary_share: amt,
	remainder: amt,
});
export type SplitByReservationOutput = z.infer<typeof SplitByReservationOutputSchema>;

export const SplitByGuestInputSchema = z.object({
	total: posAmt,
	overall_guest_count: posInt.min(1),
	my_guests: posInt.min(1),
	is_primary: z.boolean(),
});
export type SplitByGuestInput = z.infer<typeof SplitByGuestInputSchema>;

export const SplitByGuestOutputSchema = z.object({
	my_share: amt,
	remainder: amt,
});
export type SplitByGuestOutput = z.infer<typeof SplitByGuestOutputSchema>;

export const SplitComponentInputSchema = z.object({
	component_rate: posAmt,
	divisor: posInt.min(2),
	is_primary: z.boolean(),
});
export type SplitComponentInput = z.infer<typeof SplitComponentInputSchema>;

export const SplitComponentOutputSchema = z.object({
	share: amt,
	remainder: amt,
});
export type SplitComponentOutput = z.infer<typeof SplitComponentOutputSchema>;

// =====================================================
// DEPOSIT SCHEMAS (CORE.md §8)
// =====================================================

export const DepositEntireStayInputSchema = z.object({
	percentage_of_stay: pct,
	total_reservation_charge: posAmt,
});
export type DepositEntireStayInput = z.infer<typeof DepositEntireStayInputSchema>;

export const DepositEntireStayOutputSchema = z.object({
	deposit_amount: amt,
});
export type DepositEntireStayOutput = z.infer<typeof DepositEntireStayOutputSchema>;

export const DepositPerGuestInputSchema = z.object({
	per_adult_rate: posAmt,
	num_adults: posInt,
	per_child_rate: posAmt.default(0),
	num_children: posInt.default(0),
});
export type DepositPerGuestInput = z.infer<typeof DepositPerGuestInputSchema>;

export const DepositPerGuestOutputSchema = z.object({
	deposit_amount: amt,
});
export type DepositPerGuestOutput = z.infer<typeof DepositPerGuestOutputSchema>;

export const DepositCapInputSchema = z.object({
	cumulative_schedule_total: posAmt,
	total_reservation_charge: posAmt,
	due_amount: posAmt,
});
export type DepositCapInput = z.infer<typeof DepositCapInputSchema>;

export const DepositCapOutputSchema = z.object({
	collectible: amt,
	excess: amt,
	capped: z.boolean(),
});
export type DepositCapOutput = z.infer<typeof DepositCapOutputSchema>;

// =====================================================
// COMMISSION SCHEMAS (CORE.md §11)
// =====================================================

export const CommissionAmountInputSchema = z.object({
	rate_plan_total: posAmt,
	commission_percent: pct,
});
export type CommissionAmountInput = z.infer<typeof CommissionAmountInputSchema>;

export const CommissionAmountOutputSchema = z.object({
	commission_amount: amt,
});
export type CommissionAmountOutput = z.infer<typeof CommissionAmountOutputSchema>;

export const CommissionBackCalcInputSchema = z.object({
	commission_amount: posAmt,
	room_rate: posAmt.refine(v => v > 0, "Room rate must be positive"),
});
export type CommissionBackCalcInput = z.infer<typeof CommissionBackCalcInputSchema>;

export const CommissionBackCalcOutputSchema = z.object({
	commission_percent: z.number(),
});
export type CommissionBackCalcOutput = z.infer<typeof CommissionBackCalcOutputSchema>;

// =====================================================
// AUTHORIZATION SCHEMAS (CORE.md §7)
// =====================================================

export const AuthTdacInputSchema = z.object({
	estimated_total: posAmt,
	posted_payment: amt,
	percentage_buffer: pct,
});
export type AuthTdacInput = z.infer<typeof AuthTdacInputSchema>;

export const AuthTdacOutputSchema = z.object({
	authorization_amount: amt,
});
export type AuthTdacOutput = z.infer<typeof AuthTdacOutputSchema>;

export const AuthRtdcTypeEnum = z.enum(["percentage", "per_person"]);

export const AuthRtdcInputSchema = z.object({
	type: AuthRtdcTypeEnum,
	value: z.number().nonnegative(),
	posted_room_charges: posAmt.default(0),
	posted_room_taxes: posAmt.default(0),
	future_room_charge_total: posAmt.default(0),
	number_of_persons: posInt.default(1),
	maximum_days_to_authorize: posInt.default(1),
});
export type AuthRtdcInput = z.infer<typeof AuthRtdcInputSchema>;

export const AuthRtdcOutputSchema = z.object({
	authorization_amount: amt,
});
export type AuthRtdcOutput = z.infer<typeof AuthRtdcOutputSchema>;

// =====================================================
// CANCELLATION FEE SCHEMAS (CORE.md §10)
// =====================================================

export const CancellationPolicyTypeEnum = z.enum(["percentage", "nights", "flat"]);

export const CancellationFeeInputSchema = z.object({
	policy_type: CancellationPolicyTypeEnum,
	nightly_rates: z.array(posAmt).min(1),
	percentage: pct.optional(),
	nights: posInt.optional(),
	override_percentage: pct.optional(),
});
export type CancellationFeeInput = z.infer<typeof CancellationFeeInputSchema>;

export const CancellationFeeOutputSchema = z.object({
	fee: amt,
	applicable_nights: posInt,
});
export type CancellationFeeOutput = z.infer<typeof CancellationFeeOutputSchema>;

// =====================================================
// YIELD RATE SCHEMAS (CORE.md §17)
// =====================================================

export const YieldModifierTypeEnum = z.enum(["PERCENT", "FLAT_RATE", "DECREASE_BY"]);

export const YieldModifierSchema = z.object({
	type: YieldModifierTypeEnum,
	value: z.number(),
});

export const YieldRateInputSchema = z.object({
	actual_rate: posAmt,
	modifiers: z.array(YieldModifierSchema),
	min_rate: posAmt.default(0),
});
export type YieldRateInput = z.infer<typeof YieldRateInputSchema>;

export const YieldRateOutputSchema = z.object({
	yielded_rate: amt,
	clamped_to_min: z.boolean(),
});
export type YieldRateOutput = z.infer<typeof YieldRateOutputSchema>;

// =====================================================
// FOREX SCHEMAS (CORE.md §12)
// =====================================================

export const ForexSurchargeTypeEnum = z.enum(["FLAT", "PERCENTAGE"]);

export const ForexConvertInputSchema = z.object({
	amount: posAmt,
	from_currency: z.string().length(3),
	to_currency: z.string().length(3),
	conversion_rate: z.number().positive(),
	surcharge_type: ForexSurchargeTypeEnum,
	surcharge_amount: posAmt.default(0),
});
export type ForexConvertInput = z.infer<typeof ForexConvertInputSchema>;

export const ForexConvertOutputSchema = z.object({
	converted_amount: amt,
	effective_rate: z.number(),
	surcharge_applied: amt,
});
export type ForexConvertOutput = z.infer<typeof ForexConvertOutputSchema>;

// =====================================================
// PRORATION SCHEMAS (Industry Standard)
// =====================================================

export const ProrationInputSchema = z.object({
	daily_rate: posAmt,
	hours: z.number().min(0).max(24).describe("Hours to prorate (0-24)"),
	rounding: z.enum(["HALF_UP", "HALF_EVEN"]).default("HALF_UP"),
});
export type ProrationInput = z.infer<typeof ProrationInputSchema>;

export const ProrationOutputSchema = z.object({
	prorated_amount: amt,
	fraction: z.number(),
});
export type ProrationOutput = z.infer<typeof ProrationOutputSchema>;

export const LosTierSchema = z.object({
	from_night: posInt.min(1),
	to_night: posInt.optional().describe("Omit for open-ended (day X+)"),
	rate: posAmt,
});

export const LosTieredInputSchema = z.object({
	tiers: z.array(LosTierSchema).min(1),
	nights: posInt.min(1),
});
export type LosTieredInput = z.infer<typeof LosTieredInputSchema>;

export const LosTieredOutputSchema = z.object({
	nightly_amounts: z.array(z.number()),
	total: amt,
	average_nightly: amt,
});
export type LosTieredOutput = z.infer<typeof LosTieredOutputSchema>;

export const DerivedRateInputSchema = z.object({
	parent_rate: posAmt,
	discount_percent: pct,
});
export type DerivedRateInput = z.infer<typeof DerivedRateInputSchema>;

export const DerivedRateOutputSchema = z.object({
	derived_rate: amt,
	discount_amount: amt,
});
export type DerivedRateOutput = z.infer<typeof DerivedRateOutputSchema>;

// =====================================================
// ALLOWANCE & PACKAGE SCHEMAS (CORE.md §9)
// =====================================================

export const AllowanceTrackInputSchema = z.object({
	total_allowance: posAmt,
	charges: z.array(posAmt).min(1).describe("Sequential charges against allowance"),
});
export type AllowanceTrackInput = z.infer<typeof AllowanceTrackInputSchema>;

export const AllowanceTrackOutputSchema = z.object({
	remaining: amt,
	spent: amt,
	breakage: amt.describe("Unused allowance"),
	charges: z.array(
		z.object({
			covered: amt,
			excess: amt,
		}),
	),
});
export type AllowanceTrackOutput = z.infer<typeof AllowanceTrackOutputSchema>;

export const EnhancementItemInputSchema = z.object({
	default_price: posAmt,
	quantity: posInt.min(1),
	number_of_dates: posInt.min(1),
});
export type EnhancementItemInput = z.infer<typeof EnhancementItemInputSchema>;

export const EnhancementItemOutputSchema = z.object({
	per_date_total: amt,
	grand_total: amt,
});
export type EnhancementItemOutput = z.infer<typeof EnhancementItemOutputSchema>;

export const PackageAllocationComponentSchema = z.object({
	name: z.string(),
	amount: posAmt,
});

export const PackageAllocationInputSchema = z.object({
	package_rate: posAmt,
	components: z.array(PackageAllocationComponentSchema).min(1),
});
export type PackageAllocationInput = z.infer<typeof PackageAllocationInputSchema>;

export const PackageAllocationOutputSchema = z.object({
	allocations: z.array(
		z.object({
			name: z.string(),
			amount: amt,
			percentage: z.number(),
		}),
	),
	total: amt,
});
export type PackageAllocationOutput = z.infer<typeof PackageAllocationOutputSchema>;

// =====================================================
// COMP OFFER & ACCOUNTING SCHEMAS (CORE.md §2.11-2.13, §14)
// =====================================================

export const CompDiscountTypeEnum = z.enum(["PERCENTAGE", "AMOUNT"]);

export const CompOfferInputSchema = z.object({
	applicable_rate: posAmt,
	discount_type: CompDiscountTypeEnum,
	discount_value: z.number().nonnegative(),
});
export type CompOfferInput = z.infer<typeof CompOfferInputSchema>;

export const CompOfferOutputSchema = z.object({
	comp_rate: amt,
	discount_amount: amt,
});
export type CompOfferOutput = z.infer<typeof CompOfferOutputSchema>;

export const CompBalanceInputSchema = z.object({
	current_balance: posAmt,
	comp_amount: posAmt,
});
export type CompBalanceInput = z.infer<typeof CompBalanceInputSchema>;

export const CompBalanceOutputSchema = z.object({
	new_balance: amt,
	fully_consumed: z.boolean(),
});
export type CompBalanceOutput = z.infer<typeof CompBalanceOutputSchema>;

export const CompRecalcInputSchema = z.object({
	old_amount_per_stay: posAmt,
	old_balance: posAmt,
	new_amount_per_stay: posAmt,
});
export type CompRecalcInput = z.infer<typeof CompRecalcInputSchema>;

export const CompRecalcOutputSchema = z.object({
	redeemed: amt,
	new_balance: amt,
});
export type CompRecalcOutput = z.infer<typeof CompRecalcOutputSchema>;

// =====================================================
// LOYALTY / POINTS SCHEMAS (CORE.md §13)
// =====================================================

export const PointsToMoneyInputSchema = z.object({
	point_balance: z.number().nonnegative(),
	conversion_rate: z.number().positive().describe("Monetary value per point"),
});
export type PointsToMoneyInput = z.infer<typeof PointsToMoneyInputSchema>;

export const PointsToMoneyOutputSchema = z.object({
	monetary_value: amt,
});
export type PointsToMoneyOutput = z.infer<typeof PointsToMoneyOutputSchema>;

export const MoneyToPointsInputSchema = z.object({
	amount: posAmt,
	conversion_rate: z.number().positive().describe("Monetary value per point"),
});
export type MoneyToPointsInput = z.infer<typeof MoneyToPointsInputSchema>;

export const MoneyToPointsOutputSchema = z.object({
	points: z.number().int().nonnegative(),
});
export type MoneyToPointsOutput = z.infer<typeof MoneyToPointsOutputSchema>;

export const PointsRedemptionInputSchema = z.object({
	authorized_per_stay: posAmt,
	redeemed_so_far: posAmt,
	redemption_amount: posAmt,
});
export type PointsRedemptionInput = z.infer<typeof PointsRedemptionInputSchema>;

export const PointsRedemptionOutputSchema = z.object({
	approved_amount: amt,
	remaining_authorized: amt,
	over_limit: z.boolean(),
});
export type PointsRedemptionOutput = z.infer<typeof PointsRedemptionOutputSchema>;

// =====================================================
// REVENUE FORECAST SCHEMAS (Industry Standard)
// =====================================================

export const OverbookingInputSchema = z.object({
	total_rooms: posInt.min(1),
	no_show_percent: pct,
	cancellation_percent: pct,
	safety_factor: z.number().min(0).max(1).default(0.8),
});
export type OverbookingInput = z.infer<typeof OverbookingInputSchema>;

export const OverbookingOutputSchema = z.object({
	overbook_level: z.number().int().nonnegative(),
	effective_capacity: z.number().int(),
});
export type OverbookingOutput = z.infer<typeof OverbookingOutputSchema>;

export const GroupForecastInputSchema = z.object({
	base_price: posAmt,
	blocked_rooms: posInt,
	picked_up_rooms: posInt,
});
export type GroupForecastInput = z.infer<typeof GroupForecastInputSchema>;

export const GroupForecastOutputSchema = z.object({
	forecast_revenue: amt,
	actual_revenue: amt,
	pickup_percentage: z.number(),
	revenue_variance: amt,
});
export type GroupForecastOutput = z.infer<typeof GroupForecastOutputSchema>;

export const DisplacementInputSchema = z.object({
	group_rate: posAmt,
	group_rooms: posInt.min(1),
	group_ancillary_per_room: posAmt.default(0),
	transient_adr: posAmt,
	transient_ancillary_per_room: posAmt.default(0),
	expected_transient_occupancy_pct: pct,
});
export type DisplacementInput = z.infer<typeof DisplacementInputSchema>;

export const DisplacementOutputSchema = z.object({
	group_total_contribution: amt,
	displaced_transient_contribution: amt,
	net_value: amt,
	accept_group: z.boolean(),
});
export type DisplacementOutput = z.infer<typeof DisplacementOutputSchema>;

export const NoShowChargeInputSchema = z.object({
	first_night_rate: posAmt,
	tax_rate: pct.default(0),
	cancellation_fee: posAmt.default(0),
});
export type NoShowChargeInput = z.infer<typeof NoShowChargeInputSchema>;

export const NoShowChargeOutputSchema = z.object({
	charge: amt,
	tax: amt,
	total: amt,
});
export type NoShowChargeOutput = z.infer<typeof NoShowChargeOutputSchema>;

export const ExtraGuestChargeInputSchema = z.object({
	base_rate: posAmt,
	extra_adult_charge: posAmt.default(0),
	extra_child_charge: posAmt.default(0),
	adults: posInt,
	children: posInt.default(0),
	adults_included: posInt,
	children_included: posInt.default(0),
});
export type ExtraGuestChargeInput = z.infer<typeof ExtraGuestChargeInputSchema>;

export const ExtraGuestChargeOutputSchema = z.object({
	extra_adult_total: amt,
	extra_child_total: amt,
	total_surcharge: amt,
	total_rate: amt,
});
export type ExtraGuestChargeOutput = z.infer<typeof ExtraGuestChargeOutputSchema>;
