/**
 * Reservations Schema
 * @table reservations
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";
import {
	ReservationStatusEnum,
	ReservationSourceEnum,
} from "../../shared/enums.js";

/**
 * Complete Reservations schema
 */
export const ReservationsSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	guest_id: uuid,
	room_type_id: uuid,
	rate_id: uuid.optional(),
	confirmation_number: z.string(),
	check_in_date: z.coerce.date(),
	check_out_date: z.coerce.date(),
	booking_date: z.coerce.date(),
	actual_check_in: z.coerce.date().optional(),
	actual_check_out: z.coerce.date().optional(),
	room_number: z.string().optional(),
	number_of_adults: z.number().int(),
	number_of_children: z.number().int().optional(),
	number_of_infants: z.number().int().optional(),
	room_rate: money,
	total_amount: money,
	tax_amount: money.optional(),
	discount_amount: money.optional(),
	paid_amount: money.optional(),
	balance_due: money.optional(),
	currency: z.string().optional(),
	status: ReservationStatusEnum,
	source: ReservationSourceEnum,
	channel_reference: z.string().optional(),
	guest_name: z.string(),
	guest_email: z.string(),
	guest_phone: z.string().optional(),
	special_requests: z.string().optional(),
	internal_notes: z.string().optional(),
	guarantee_type: z.string().optional(),
	credit_card_last4: z.string().optional(),
	cancellation_date: z.coerce.date().optional(),
	cancellation_reason: z.string().optional(),
	cancellation_fee: money.optional(),
	is_no_show: z.boolean().optional(),
	no_show_date: z.coerce.date().optional(),
	no_show_fee: money.optional(),
	promo_code: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	created_by: z.string().optional(),
	updated_by: z.string().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().optional(),
	version: z.bigint().optional(),
});

export type Reservations = z.infer<typeof ReservationsSchema>;

/**
 * Schema for creating a new reservations
 */
export const CreateReservationsSchema = ReservationsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateReservations = z.infer<typeof CreateReservationsSchema>;

/**
 * Schema for updating a reservations
 */
export const UpdateReservationsSchema = ReservationsSchema.partial();

export type UpdateReservations = z.infer<typeof UpdateReservationsSchema>;
