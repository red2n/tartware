/**
 * DEV DOC
 * Module: schemas/05-operations/spa-appointments.ts
 * Description: SpaAppointments Schema
 * Table: spa_appointments
 * Category: 05-operations
 * Primary exports: SpaAppointmentsSchema, CreateSpaAppointmentsSchema, UpdateSpaAppointmentsSchema
 * @table spa_appointments
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * SpaAppointments Schema
 * @table spa_appointments
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete SpaAppointments schema
 */
export const SpaAppointmentsSchema = z.object({
	appointment_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	treatment_id: uuid,
	guest_id: uuid.optional(),
	reservation_id: uuid.optional(),
	folio_id: uuid.optional(),
	appointment_date: z.coerce.date(),
	start_time: z.string(),
	end_time: z.string(),
	timezone: z.string().optional(),
	status: z.string(),
	booking_source: z.string().optional(),
	booking_notes: z.string().optional(),
	primary_therapist_id: uuid.optional(),
	secondary_therapist_id: uuid.optional(),
	room_id: uuid.optional(),
	required_resources: z.record(z.unknown()).optional(),
	guest_preferences: z.string().optional(),
	special_requests: z.string().optional(),
	contraindications: z.string().optional(),
	base_price: money.optional(),
	discount_amount: money.optional(),
	tax_amount: money.optional(),
	gratuity_amount: money.optional(),
	total_amount: money.optional(),
	currency: z.string().optional(),
	payment_status: z.string().optional(),
	cancelled_at: z.coerce.date().optional(),
	cancelled_by: uuid.optional(),
	cancellation_reason: z.string().optional(),
	no_show_fee: money.optional(),
	check_in_time: z.coerce.date().optional(),
	service_start_time: z.coerce.date().optional(),
	service_end_time: z.coerce.date().optional(),
	check_out_time: z.coerce.date().optional(),
	feedback_rating: z.number().int().optional(),
	feedback_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type SpaAppointments = z.infer<typeof SpaAppointmentsSchema>;

/**
 * Schema for creating a new spa appointments
 */
export const CreateSpaAppointmentsSchema = SpaAppointmentsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateSpaAppointments = z.infer<typeof CreateSpaAppointmentsSchema>;

/**
 * Schema for updating a spa appointments
 */
export const UpdateSpaAppointmentsSchema = SpaAppointmentsSchema.partial();

export type UpdateSpaAppointments = z.infer<typeof UpdateSpaAppointmentsSchema>;
