/**
 * DEV DOC
 * Module: schemas/03-bookings/allotments.ts
 * Description: Allotments Schema
 * Table: allotments
 * Category: 03-bookings
 * Primary exports: AllotmentsSchema, CreateAllotmentsSchema, UpdateAllotmentsSchema
 * @table allotments
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * Allotments Schema
 * @table allotments
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete Allotments schema
 */
export const AllotmentsSchema = z.object({
	allotment_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	allotment_code: z.string(),
	allotment_name: z.string(),
	allotment_type: z.string(),
	allotment_status: z.string(),
	start_date: z.coerce.date(),
	end_date: z.coerce.date(),
	cutoff_date: z.coerce.date().optional(),
	cutoff_days_prior: z.number().int().optional(),
	room_type_id: uuid.optional(),
	total_rooms_blocked: z.number().int(),
	total_room_nights: z.number().int().optional(),
	rooms_per_night: z.number().int().optional(),
	rooms_picked_up: z.number().int().optional(),
	rooms_available: z.number().int().optional(),
	pickup_percentage: money.optional(),
	rate_type: z.string().optional(),
	contracted_rate: money.optional(),
	min_rate: money.optional(),
	max_rate: money.optional(),
	total_expected_revenue: money.optional(),
	actual_revenue: money.optional(),
	currency_code: z.string().optional(),
	account_name: z.string().optional(),
	account_type: z.string().optional(),
	billing_type: z.string().optional(),
	master_folio_id: uuid.optional(),
	contact_name: z.string().optional(),
	contact_title: z.string().optional(),
	contact_email: z.string().optional(),
	contact_phone: z.string().optional(),
	contact_company: z.string().optional(),
	booking_source_id: uuid.optional(),
	booking_reference: z.string().optional(),
	channel: z.string().optional(),
	market_segment_id: uuid.optional(),
	deposit_required: z.boolean().optional(),
	deposit_amount: money.optional(),
	deposit_percentage: money.optional(),
	deposit_due_date: z.coerce.date().optional(),
	cancellation_policy: z.string().optional(),
	cancellation_deadline: z.coerce.date().optional(),
	cancellation_fee_amount: money.optional(),
	attrition_clause: z.boolean().optional(),
	attrition_percentage: money.optional(),
	attrition_penalty: money.optional(),
	guaranteed_rooms: z.number().int().optional(),
	on_hold_rooms: z.number().int().optional(),
	elastic_limit: z.number().int().optional(),
	rate_details: z.record(z.unknown()).optional(),
	special_requests: z.string().optional(),
	amenities_included: z.array(z.string()).optional(),
	setup_requirements: z.string().optional(),
	commission_percentage: money.optional(),
	commission_amount: money.optional(),
	commissionable_amount: money.optional(),
	confirmed_at: z.coerce.date().optional(),
	confirmed_by: uuid.optional(),
	activated_at: z.coerce.date().optional(),
	completed_at: z.coerce.date().optional(),
	cancelled_at: z.coerce.date().optional(),
	cancelled_by: uuid.optional(),
	cancellation_reason: z.string().optional(),
	account_manager_id: uuid.optional(),
	operations_manager_id: uuid.optional(),
	is_vip: z.boolean().optional(),
	priority_level: z.number().int().optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	created_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type Allotments = z.infer<typeof AllotmentsSchema>;

/**
 * Schema for creating a new allotments
 */
export const CreateAllotmentsSchema = AllotmentsSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateAllotments = z.infer<typeof CreateAllotmentsSchema>;

/**
 * Schema for updating a allotments
 */
export const UpdateAllotmentsSchema = AllotmentsSchema.partial();

export type UpdateAllotments = z.infer<typeof UpdateAllotmentsSchema>;
