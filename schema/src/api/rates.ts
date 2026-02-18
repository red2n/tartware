/**
 * DEV DOC
 * Module: api/rates.ts
 * Purpose: Rate CRUD API schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { RateItemSchema } from "../schemas/02-inventory/rates.js";
import { uuid } from "../shared/base-schemas.js";
import {
	RateStatusEnum,
	RateStrategyEnum,
	RateTypeEnum,
} from "../shared/enums.js";

// -----------------------------------------------------------------------------
// Query Schemas
// -----------------------------------------------------------------------------

/** Query schema for listing rates with optional filters. */
export const RateListQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid.optional(),
	room_type_id: uuid.optional(),
	status: z
		.string()
		.toUpperCase()
		.optional()
		.refine(
			(value) =>
				!value ||
				RateStatusEnum.options.includes(
					value as (typeof RateStatusEnum.options)[number],
				),
			{ message: "Invalid rate status" },
		),
	rate_type: z
		.string()
		.toUpperCase()
		.optional()
		.refine(
			(value) =>
				!value ||
				RateTypeEnum.options.includes(
					value as (typeof RateTypeEnum.options)[number],
				),
			{ message: "Invalid rate type" },
		),
	search: z.string().min(1).max(80).optional(),
	limit: z.coerce.number().int().positive().max(500).default(200),
	offset: z.coerce.number().int().min(0).default(0),
});

export type RateListQuery = z.infer<typeof RateListQuerySchema>;

/** Response schema for rate list endpoint. */
export const RateListResponseSchema = z.array(RateItemSchema);
export type RateListResponse = z.infer<typeof RateListResponseSchema>;

// -----------------------------------------------------------------------------
// Body Schemas
// -----------------------------------------------------------------------------

/** Body schema for creating a rate. */
export const CreateRateBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	rate_name: z.string().min(1).max(255),
	rate_code: z
		.string()
		.min(2)
		.max(50)
		.regex(/^[A-Za-z0-9_-]+$/, {
			message: "Rate code must be alphanumeric (with _ or -)",
		})
		.transform((value) => value.toUpperCase()),
	description: z.string().max(1000).optional(),
	rate_type: z
		.string()
		.toUpperCase()
		.optional()
		.refine(
			(value) =>
				!value ||
				RateTypeEnum.options.includes(
					value as (typeof RateTypeEnum.options)[number],
				),
			{ message: "Invalid rate type" },
		),
	strategy: z
		.string()
		.toUpperCase()
		.optional()
		.refine(
			(value) =>
				!value ||
				RateStrategyEnum.options.includes(
					value as (typeof RateStrategyEnum.options)[number],
				),
			{ message: "Invalid rate strategy" },
		),
	priority: z.number().int().min(0).max(999).optional(),
	base_rate: z.number().min(0),
	currency: z.string().length(3).optional(),
	single_occupancy_rate: z.number().min(0).optional(),
	double_occupancy_rate: z.number().min(0).optional(),
	extra_person_rate: z.number().min(0).optional(),
	extra_child_rate: z.number().min(0).optional(),
	valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
		message: "Date must be YYYY-MM-DD format",
	}),
	valid_until: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, {
			message: "Date must be YYYY-MM-DD format",
		})
		.optional(),
	advance_booking_days_min: z.number().int().min(0).optional(),
	advance_booking_days_max: z.number().int().min(0).optional(),
	min_length_of_stay: z.number().int().min(1).optional(),
	max_length_of_stay: z.number().int().min(1).optional(),
	closed_to_arrival: z.boolean().optional(),
	closed_to_departure: z.boolean().optional(),
	meal_plan: z.string().max(50).optional(),
	meal_plan_cost: z.number().min(0).optional(),
	cancellation_policy: z.record(z.unknown()).optional(),
	modifiers: z.record(z.unknown()).optional(),
	channels: z.array(z.string()).optional(),
	customer_segments: z.array(z.string()).optional(),
	tax_inclusive: z.boolean().optional(),
	tax_rate: z.number().min(0).max(100).optional(),
	status: z
		.string()
		.toUpperCase()
		.optional()
		.refine(
			(value) =>
				!value ||
				RateStatusEnum.options.includes(
					value as (typeof RateStatusEnum.options)[number],
				),
			{ message: "Invalid rate status" },
		),
	display_order: z.number().int().min(0).optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type CreateRateBody = z.infer<typeof CreateRateBodySchema>;

/** Body schema for updating a rate (all fields optional except tenant_id). */
export const UpdateRateBodySchema = CreateRateBodySchema.partial().extend({
	tenant_id: uuid,
});

export type UpdateRateBody = z.infer<typeof UpdateRateBodySchema>;
