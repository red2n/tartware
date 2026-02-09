/**
 * DEV DOC
 * Module: schemas/03-bookings/reservations.ts
 * Description: Reservations Schema
 * Table: reservations
 * Category: 03-bookings
 * Primary exports: ReservationsSchema, CreateReservationsSchema, UpdateReservationsSchema
 * @table reservations
 * @category 03-bookings
 * Ownership: Schema package
 */

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
	ReservationTypeEnum,
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
	room_number: z.string().nullable().optional(),
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
	reservation_type: ReservationTypeEnum.optional(),
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
	eta: z.coerce.date().optional(),
	company_id: uuid.optional(),
	travel_agent_id: uuid.optional(),
	quoted_at: z.coerce.date().optional(),
	quote_expires_at: z.coerce.date().optional(),
	expired_at: z.coerce.date().optional(),
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
 * Schema for creating a new reservation.
 *
 * Omits auto-generated, lifecycle, and computed fields that are managed by the
 * system rather than provided by the caller:
 * - Audit: id, created_at, updated_at, created_by, updated_by, version, is_deleted, deleted_at, deleted_by
 * - Lifecycle: actual_check_in, actual_check_out, cancellation_*, is_no_show, no_show_*
 * - Computed: confirmation_number, paid_amount, balance_due, status (defaults to PENDING)
 */
export const CreateReservationsSchema = ReservationsSchema.omit({
	// Audit / system fields
	id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	version: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
	// Auto-generated
	confirmation_number: true,
	// Lifecycle (set by domain commands)
	actual_check_in: true,
	actual_check_out: true,
	cancellation_date: true,
	cancellation_reason: true,
	cancellation_fee: true,
	is_no_show: true,
	no_show_date: true,
	no_show_fee: true,
	// Quote/expire lifecycle (set by domain commands)
	quoted_at: true,
	quote_expires_at: true,
	expired_at: true,
	// Computed by billing
	paid_amount: true,
	balance_due: true,
	// Defaults to PENDING on creation
	status: true,
});

export type CreateReservations = z.infer<typeof CreateReservationsSchema>;

/**
 * Schema for updating a reservation.
 *
 * Only mutable business fields are exposed; all are optional so callers can
 * submit a partial update with any subset.  Lifecycle, audit, and computed
 * fields are excluded — those are managed by dedicated domain commands.
 */
export const UpdateReservationsSchema = ReservationsSchema.pick({
	guest_id: true,
	room_type_id: true,
	rate_id: true,
	check_in_date: true,
	check_out_date: true,
	booking_date: true,
	room_number: true,
	number_of_adults: true,
	number_of_children: true,
	number_of_infants: true,
	room_rate: true,
	total_amount: true,
	tax_amount: true,
	discount_amount: true,
	currency: true,
	source: true,
	reservation_type: true,
	channel_reference: true,
	guest_name: true,
	guest_email: true,
	guest_phone: true,
	special_requests: true,
	internal_notes: true,
	guarantee_type: true,
	credit_card_last4: true,
	promo_code: true,
	metadata: true,
}).partial();

export type UpdateReservations = z.infer<typeof UpdateReservationsSchema>;
