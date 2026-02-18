/**
 * DEV DOC
 * Module: schemas/06-integrations/ota-reservations-queue.ts
 * Description: OtaReservationsQueue Schema
 * Table: ota_reservations_queue
 * Category: 06-integrations
 * Primary exports: OtaReservationsQueueSchema, CreateOtaReservationsQueueSchema, UpdateOtaReservationsQueueSchema
 * @table ota_reservations_queue
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * OtaReservationsQueue Schema
 * @table ota_reservations_queue
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete OtaReservationsQueue schema
 */
export const OtaReservationsQueueSchema = z.object({
	id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	tenant_id: uuid,
	property_id: uuid,
	ota_configuration_id: uuid,
	ota_reservation_id: z.string(),
	ota_booking_reference: z.string().optional(),
	reservation_id: uuid.optional(),
	status: z.string().optional(),
	processing_attempts: z.number().int().optional(),
	max_retry_attempts: z.number().int().optional(),
	guest_name: z.string().optional(),
	guest_email: z.string().optional(),
	guest_phone: z.string().optional(),
	check_in_date: z.coerce.date().optional(),
	check_out_date: z.coerce.date().optional(),
	room_type: z.string().optional(),
	number_of_guests: z.number().int().optional(),
	total_amount: money.optional(),
	currency_code: z.string().optional(),
	special_requests: z.string().optional(),
	raw_payload: z.record(z.unknown()).optional(),
	error_message: z.string().optional(),
	processed_at: z.coerce.date().optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
});

export type OtaReservationsQueue = z.infer<typeof OtaReservationsQueueSchema>;

/**
 * Schema for creating a new ota reservations queue
 */
export const CreateOtaReservationsQueueSchema = OtaReservationsQueueSchema.omit(
	{
		// TODO: Add fields to omit for creation
	},
);

export type CreateOtaReservationsQueue = z.infer<
	typeof CreateOtaReservationsQueueSchema
>;

/**
 * Schema for updating a ota reservations queue
 */
export const UpdateOtaReservationsQueueSchema =
	OtaReservationsQueueSchema.partial();

export type UpdateOtaReservationsQueue = z.infer<
	typeof UpdateOtaReservationsQueueSchema
>;
