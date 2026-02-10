/**
 * DEV DOC
 * Module: api/direct-booking.ts
 * Purpose: Direct booking engine API response schemas
 * Ownership: Schema package
 * S30 — Direct Booking Engine
 */

import { z } from "zod";

// -----------------------------------------------------------------------------
// Availability Search Result
// -----------------------------------------------------------------------------

/** Room type availability result for direct booking search. */
export const AvailabilityResultSchema = z.object({
	room_type_id: z.string().uuid(),
	room_type_name: z.string(),
	description: z.string().nullable(),
	max_occupancy: z.number(),
	base_rate: z.number(),
	currency: z.string(),
	available_count: z.number(),
	amenities: z.unknown().nullable(),
	images: z.unknown().nullable(),
	dynamic_rate: z.number().nullable(),
	best_rate: z.number(),
});

export type AvailabilityResult = z.infer<typeof AvailabilityResultSchema>;

// -----------------------------------------------------------------------------
// Rate Quote
// -----------------------------------------------------------------------------

/** Nightly rate entry within a rate quote. */
export const NightlyRateSchema = z.object({
	date: z.string(),
	amount: z.number(),
});

export type NightlyRate = z.infer<typeof NightlyRateSchema>;

/** Rate quote with nightly breakdown, promo code, and tax estimate. */
export const RateQuoteSchema = z.object({
	room_type_id: z.string().uuid(),
	room_type_name: z.string(),
	rate_plan_id: z.string().uuid().nullable(),
	rate_plan_name: z.string().nullable(),
	nightly_rates: z.array(NightlyRateSchema),
	total_before_tax: z.number(),
	tax_estimate: z.number(),
	total_amount: z.number(),
	currency: z.string(),
	promo_applied: z.boolean(),
	promo_discount: z.number().nullable(),
	cancellation_policy: z.string().nullable(),
});

export type RateQuote = z.infer<typeof RateQuoteSchema>;

// -----------------------------------------------------------------------------
// Booking Confirmation
// -----------------------------------------------------------------------------

/** Booking confirmation response after successful direct reservation. */
export const BookingConfirmationSchema = z.object({
	reservation_id: z.string().uuid(),
	confirmation_number: z.string(),
	status: z.string(),
	guest_id: z.string().uuid(),
	room_type: z.string(),
	check_in_date: z.string(),
	check_out_date: z.string(),
	total_amount: z.number(),
	currency: z.string(),
	created_at: z.string(),
});

export type BookingConfirmation = z.infer<typeof BookingConfirmationSchema>;
