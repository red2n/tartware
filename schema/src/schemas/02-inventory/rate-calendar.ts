/**
 * DEV DOC
 * Module: schemas/02-inventory/rate-calendar.ts
 * Description: Rate Calendar Schema — day-level pricing grid
 * Table: rate_calendar
 * Category: 02-inventory
 * Primary exports: RateCalendarSchema, RateCalendarItemSchema
 * @table rate_calendar
 * @category 02-inventory
 * Ownership: Schema package
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/** Status of a rate calendar day entry. */
export const RateCalendarStatusEnum = z.enum([
	"OPEN",
	"CLOSED",
	"STOP_SELL",
	"ON_REQUEST",
]);

/** How the calendar entry was created. */
export const RateCalendarSourceEnum = z.enum([
	"MANUAL",
	"BULK",
	"PRICING_RULE",
	"CHANNEL_MANAGER",
	"IMPORT",
]);

/**
 * Complete Rate Calendar schema (maps to rate_calendar table).
 */
export const RateCalendarSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	rate_id: uuid,
	stay_date: z.coerce.date(),
	rate_amount: money,
	currency: z.string().max(3).default("USD"),
	single_rate: money.optional(),
	double_rate: money.optional(),
	extra_person: money.optional(),
	extra_child: money.optional(),
	status: RateCalendarStatusEnum.default("OPEN"),
	closed_to_arrival: z.boolean().default(false),
	closed_to_departure: z.boolean().default(false),
	min_length_of_stay: z.number().int().min(1).optional(),
	max_length_of_stay: z.number().int().min(1).optional(),
	min_advance_days: z.number().int().min(0).optional(),
	max_advance_days: z.number().int().min(0).optional(),
	rooms_to_sell: z.number().int().min(0).optional(),
	rooms_sold: z.number().int().min(0).default(0),
	source: RateCalendarSourceEnum.default("MANUAL"),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
});

export type RateCalendar = z.infer<typeof RateCalendarSchema>;

/**
 * API response schema for rate calendar items (JSON-serialization friendly).
 */
export const RateCalendarItemSchema = z.object({
	id: z.string().uuid(),
	tenant_id: z.string().uuid(),
	property_id: z.string().uuid(),
	room_type_id: z.string().uuid(),
	rate_id: z.string().uuid(),
	stay_date: z.string(),
	rate_amount: z.number(),
	currency: z.string(),
	single_rate: z.number().optional(),
	double_rate: z.number().optional(),
	extra_person: z.number().optional(),
	extra_child: z.number().optional(),
	status: z.string(),
	closed_to_arrival: z.boolean(),
	closed_to_departure: z.boolean(),
	min_length_of_stay: z.number().int().optional(),
	max_length_of_stay: z.number().int().optional(),
	min_advance_days: z.number().int().optional(),
	max_advance_days: z.number().int().optional(),
	rooms_to_sell: z.number().int().optional(),
	rooms_sold: z.number().int(),
	source: z.string(),
});

export type RateCalendarItem = z.infer<typeof RateCalendarItemSchema>;
