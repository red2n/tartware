/**
 * DEV DOC
 * Module: api/rate-calendar.ts
 * Purpose: Rate Calendar API schemas (query, response, body)
 * Ownership: Schema package
 */

import { z } from "zod";

import {
	RateCalendarItemSchema,
	RateCalendarSourceEnum,
	RateCalendarStatusEnum,
} from "../schemas/02-inventory/rate-calendar.js";
import { isoDateString, uuid } from "../shared/base-schemas.js";

// -----------------------------------------------------------------------------
// Query Schema
// -----------------------------------------------------------------------------

/** Query schema for fetching rate calendar entries over a date range. */
export const RateCalendarQuerySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	start_date: isoDateString,
	end_date: isoDateString,
	room_type_id: uuid.optional(),
	rate_id: uuid.optional(),
	status: RateCalendarStatusEnum.optional(),
});

export type RateCalendarQuery = z.infer<typeof RateCalendarQuerySchema>;

// -----------------------------------------------------------------------------
// Response Schema
// -----------------------------------------------------------------------------

/** Response: array of calendar entries. */
export const RateCalendarResponseSchema = z.array(RateCalendarItemSchema);
export type RateCalendarResponse = z.infer<typeof RateCalendarResponseSchema>;

// -----------------------------------------------------------------------------
// Bulk Upsert Body
// -----------------------------------------------------------------------------

/** A single day entry in a bulk upsert request. */
const RateCalendarDaySchema = z.object({
	stay_date: isoDateString,
	rate_amount: z.number().min(0),
	single_rate: z.number().min(0).optional(),
	double_rate: z.number().min(0).optional(),
	extra_person: z.number().min(0).optional(),
	extra_child: z.number().min(0).optional(),
	status: RateCalendarStatusEnum.optional(),
	closed_to_arrival: z.boolean().optional(),
	closed_to_departure: z.boolean().optional(),
	min_length_of_stay: z.number().int().min(1).optional(),
	max_length_of_stay: z.number().int().min(1).optional(),
});

/** Body schema for bulk upserting rate calendar entries. */
export const RateCalendarBulkUpsertBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	rate_id: uuid,
	currency: z.string().length(3).default("USD"),
	source: RateCalendarSourceEnum.default("MANUAL"),
	days: z.array(RateCalendarDaySchema).min(1).max(366),
});

export type RateCalendarBulkUpsertBody = z.infer<
	typeof RateCalendarBulkUpsertBodySchema
>;

/** Body schema for quick range fill (same rate for every day in a range). */
export const RateCalendarRangeFillBodySchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	room_type_id: uuid,
	rate_id: uuid,
	start_date: isoDateString,
	end_date: isoDateString,
	rate_amount: z.number().min(0),
	currency: z.string().length(3).default("USD"),
	status: RateCalendarStatusEnum.default("OPEN"),
	closed_to_arrival: z.boolean().default(false),
	closed_to_departure: z.boolean().default(false),
	min_length_of_stay: z.number().int().min(1).optional(),
	max_length_of_stay: z.number().int().min(1).optional(),
	source: RateCalendarSourceEnum.default("BULK"),
});

export type RateCalendarRangeFillBody = z.infer<
	typeof RateCalendarRangeFillBodySchema
>;
