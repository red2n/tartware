/**
 * DEV DOC
 * Module: api/reservations.ts
 * Purpose: Reservation API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

/**
 * Reservation list item schema for API responses.
 * Includes display fields derived from enum values and computed fields.
 */
export const ReservationListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	guest_id: uuid.optional(),
	room_type_id: uuid.optional(),
	room_type_name: z.string().optional(),
	confirmation_number: z.string(),
	check_in_date: z.string(),
	check_out_date: z.string(),
	nights: z.number().int().positive(),
	status: z.string(),
	status_display: z.string(),
	source: z.string().optional(),
	guest_name: z.string(),
	guest_email: z.string(),
	guest_phone: z.string().optional(),
	room_number: z.string().optional(),
	total_amount: z.number(),
	paid_amount: z.number().optional(),
	balance_due: z.number().optional(),
	currency: z.string(),
	booking_date: z.string().optional(),
	actual_check_in: z.string().optional(),
	actual_check_out: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
	notes: z.string().optional(),
	version: z.string(),
});

export type ReservationListItem = z.infer<typeof ReservationListItemSchema>;

/**
 * Reservation list response schema.
 */
export const ReservationListResponseSchema = z.object({
	data: z.array(ReservationListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type ReservationListResponse = z.infer<typeof ReservationListResponseSchema>;
