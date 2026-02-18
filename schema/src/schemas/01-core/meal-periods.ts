/**
 * DEV DOC
 * Module: schemas/01-core/meal-periods.ts
 * Description: MealPeriods Schema - Configurable meal period definitions
 * Table: meal_periods
 * Category: 01-core
 * Primary exports: MealPeriodsSchema, CreateMealPeriodsSchema, UpdateMealPeriodsSchema
 * @table meal_periods
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * MealPeriods Schema
 * Configurable meal period definitions per property with
 * timing, pricing, and rate inclusion rules.
 *
 * @table meal_periods
 * @category 01-core
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

export const MealPeriodsSchema = z.object({
	// Primary Key
	meal_period_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Meal Period Details
	period_code: z.string().min(1).max(50),
	period_name: z.string().min(1).max(100),
	period_type: z.string().max(50),

	// Timing
	default_start_time: z.string(),
	default_end_time: z.string(),
	last_seating_time: z.string().optional().nullable(),
	last_order_time: z.string().optional().nullable(),

	// Pricing
	default_price: money.optional().nullable(),
	child_price: money.optional().nullable(),
	currency_code: z.string().max(3).default("USD"),
	charge_code: z.string().max(50).optional().nullable(),

	// Configuration
	is_included_in_rate: z.boolean().default(false),
	is_buffet: z.boolean().default(false),
	is_a_la_carte: z.boolean().default(true),
	covers_forecast: z.number().int().default(0),

	// Status
	is_active: z.boolean().default(true),
	display_order: z.number().int().default(0),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
	created_by: uuid.optional().nullable(),
	updated_by: uuid.optional().nullable(),
});

export type MealPeriods = z.infer<typeof MealPeriodsSchema>;

export const CreateMealPeriodsSchema = MealPeriodsSchema.omit({
	meal_period_id: true,
	created_at: true,
	updated_at: true,
});

export type CreateMealPeriods = z.infer<typeof CreateMealPeriodsSchema>;

export const UpdateMealPeriodsSchema = MealPeriodsSchema.partial().omit({
	meal_period_id: true,
	tenant_id: true,
	property_id: true,
	created_at: true,
	created_by: true,
});

export type UpdateMealPeriods = z.infer<typeof UpdateMealPeriodsSchema>;
