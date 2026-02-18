/**
 * DEV DOC
 * Module: schemas/03-bookings/lost-business.ts
 * Description: LostBusiness Schema - Turnaway and regret tracking
 * Table: lost_business
 * Category: 03-bookings
 * Primary exports: LostBusinessSchema, CreateLostBusinessSchema, UpdateLostBusinessSchema
 * @table lost_business
 * @category 03-bookings
 * Ownership: Schema package
 */

/**
 * LostBusiness Schema
 * Tracks booking denials (no inventory) and regrets (guest declined)
 * for revenue management forecasting and demand analysis.
 *
 * @table lost_business
 * @category 03-bookings
 * @synchronized 2026-02-18
 */

import { z } from "zod";

import { uuid, money } from "../../shared/base-schemas.js";

export const LostBusinessSchema = z.object({
	// Primary Key
	lost_id: uuid,

	// Multi-tenancy
	tenant_id: uuid,
	property_id: uuid,

	// Classification
	lost_type: z.string().max(20),

	// Request Details
	requested_check_in: z.coerce.date(),
	requested_check_out: z.coerce.date(),
	requested_nights: z.number().int().optional(),
	requested_rooms: z.number().int().default(1),
	requested_room_type: z.string().max(50).optional().nullable(),
	requested_rate_code: z.string().max(50).optional().nullable(),
	quoted_rate: money.optional().nullable(),
	currency_code: z.string().max(3).default("USD"),

	// Guest Information
	guest_id: uuid.optional().nullable(),
	guest_name: z.string().max(200).optional().nullable(),
	guest_email: z.string().max(255).optional().nullable(),
	guest_phone: z.string().max(20).optional().nullable(),
	company_id: uuid.optional().nullable(),
	company_name: z.string().max(200).optional().nullable(),

	// Source & Channel
	booking_source: z.string().max(50).optional().nullable(),
	channel_code: z.string().max(50).optional().nullable(),
	market_segment: z.string().max(50).optional().nullable(),
	reservation_source: z.string().max(50).optional().nullable(),

	// Reason
	reason_code: z.string().max(50).optional().nullable(),
	denial_reason: z.string().max(100).optional().nullable(),
	regret_reason: z.string().max(100).optional().nullable(),
	competitor_name: z.string().max(200).optional().nullable(),
	competitor_rate: money.optional().nullable(),
	notes: z.string().optional().nullable(),

	// Revenue Impact
	estimated_revenue_lost: money.optional().nullable(),
	estimated_total_revenue_lost: money.optional().nullable(),

	// Recovery
	alternative_offered: z.boolean().default(false),
	alternative_property_id: uuid.optional().nullable(),
	alternative_room_type: z.string().max(50).optional().nullable(),
	alternative_rate: money.optional().nullable(),
	recovery_successful: z.boolean().default(false),

	// Agent
	recorded_by: uuid.optional().nullable(),
	recorded_via: z.string().max(50).optional().nullable(),

	// Custom Metadata
	metadata: z.record(z.unknown()).optional(),

	// Audit Fields
	created_at: z.coerce.date().default(() => new Date()),
	updated_at: z.coerce.date().optional().nullable(),
});

export type LostBusiness = z.infer<typeof LostBusinessSchema>;

export const CreateLostBusinessSchema = LostBusinessSchema.omit({
	lost_id: true,
	created_at: true,
	updated_at: true,
	requested_nights: true,
});

export type CreateLostBusiness = z.infer<typeof CreateLostBusinessSchema>;

export const UpdateLostBusinessSchema = LostBusinessSchema.partial().omit({
	lost_id: true,
	tenant_id: true,
	property_id: true,
	created_at: true,
	requested_nights: true,
});

export type UpdateLostBusiness = z.infer<typeof UpdateLostBusinessSchema>;
