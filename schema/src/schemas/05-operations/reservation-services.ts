/**
 * DEV DOC
 * Module: schemas/05-operations/reservation-services.ts
 * Description: ReservationServices Schema
 * Table: reservation_services
 * Category: 05-operations
 * Primary exports: ReservationServicesSchema, CreateReservationServicesSchema, UpdateReservationServicesSchema
 * @table reservation_services
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * ReservationServices Schema
 * @table reservation_services
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete ReservationServices schema
 */
export const ReservationServicesSchema = z.object({
	id: uuid,
	reservation_id: uuid,
	service_id: uuid,
	tenant_id: uuid,
	service_name: z.string(),
	service_code: z.string().optional(),
	quantity: money,
	unit_price: money,
	total_price: money,
	currency: z.string().optional(),
	tax_rate: money.optional(),
	tax_amount: money.optional(),
	service_date: z.coerce.date(),
	service_time: z.string().optional(),
	status: z.string().optional(),
	booking_date: z.coerce.date().optional(),
	scheduled_time: z.coerce.date().optional(),
	completed_time: z.coerce.date().optional(),
	notes: z.string().optional(),
	guest_instructions: z.string().optional(),
	assigned_to: z.string().optional(),
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

export type ReservationServices = z.infer<typeof ReservationServicesSchema>;

/**
 * Schema for creating a new reservation services
 */
export const CreateReservationServicesSchema = ReservationServicesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateReservationServices = z.infer<
	typeof CreateReservationServicesSchema
>;

/**
 * Schema for updating a reservation services
 */
export const UpdateReservationServicesSchema =
	ReservationServicesSchema.partial();

export type UpdateReservationServices = z.infer<
	typeof UpdateReservationServicesSchema
>;
