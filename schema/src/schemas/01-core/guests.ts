/**
 * DEV DOC
 * Module: schemas/01-core/guests.ts
 * Description: Guests Schema
 * Table: guests
 * Category: 01-core
 * Primary exports: GuestSchema, GuestWithStatsSchema, CreateGuestSchema, UpdateGuestSchema
 * @table guests
 * @category 01-core
 * Ownership: Schema package
 */

/**
 * Guests Schema
 * @table guests
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from "zod";

import {
	uuid,
	money,
	jsonbMetadata,
	auditTimestamps,
	softDelete,
	email,
	phoneNumber,
} from "../../shared/base-schemas.js";

const AddressSchema = z.object({
	street: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	postalCode: z.string().optional(),
	country: z.string().optional(),
});

const CommunicationPreferencesSchema = z.object({
	email: z.boolean().default(true),
	sms: z.boolean().default(false),
	phone: z.boolean().default(true),
	post: z.boolean().default(false),
});

const GuestPreferencesSchema = z.object({
	smoking: z.boolean().default(false),
	tenant_id: uuid,
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: z.string().max(100).optional(),
	language: z.string().length(2).default("en"),
	dietaryRestrictions: z.array(z.string()).default([]),
	specialRequests: z.array(z.string()).default([]),
	roomType: z.string().optional(),
	floor: z.string().optional(),
	bedType: z.enum(["KING", "QUEEN", "TWIN", "DOUBLE"]).optional(),
}).passthrough();

/**
 * Complete Guest schema
 */
export const GuestSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	first_name: z.string().min(1),
	last_name: z.string().min(1),
	middle_name: z.string().optional(),
	title: z.string().optional(),
	date_of_birth: z.coerce.date().optional(),
	gender: z.string().optional(),
	nationality: z.string().optional(),
	email: email,
	phone: phoneNumber.optional(),
	secondary_phone: phoneNumber.optional(),
	address: AddressSchema.default({}),
	id_type: z.string().optional(),
	id_number: z.string().optional(),
	passport_number: z.string().optional(),
	passport_expiry: z.coerce.date().optional(),
	company_name: z.string().optional(),
	company_tax_id: z.string().optional(),
	loyalty_tier: z.string().optional(),
	loyalty_points: z.number().int().nonnegative().default(0),
	vip_status: z.boolean().default(false),
	preferences: GuestPreferencesSchema.default({}),
	marketing_consent: z.boolean().default(false),
	communication_preferences: CommunicationPreferencesSchema.default({}),
	total_bookings: z.number().int().nonnegative().default(0),
	total_nights: z.number().int().nonnegative().default(0),
	total_revenue: money.default(0),
	last_stay_date: z.coerce.date().optional(),
	is_blacklisted: z.boolean().default(false),
	blacklist_reason: z.string().optional(),
	notes: z.string().optional(),
	metadata: jsonbMetadata,
	...auditTimestamps,
	...softDelete,
	version: z.bigint().default(BigInt(0)),
});

export type Guest = z.infer<typeof GuestSchema>;

export const GuestWithStatsSchema = GuestSchema.extend({
	upcoming_reservations: z.number().int().nonnegative().optional(),
	past_reservations: z.number().int().nonnegative().optional(),
	cancelled_reservations: z.number().int().nonnegative().optional(),
	average_stay_length: z.number().nonnegative().optional(),
	preferred_room_types: z.array(z.string()).optional(),
	lifetime_value: money.optional(),
});

export type GuestWithStats = z.infer<typeof GuestWithStatsSchema>;

export const CreateGuestSchema = GuestSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	deleted_at: true,
	version: true,
});

export type CreateGuest = z.infer<typeof CreateGuestSchema>;

export const UpdateGuestSchema = GuestSchema.partial().extend({
	id: uuid,
});

export type UpdateGuest = z.infer<typeof UpdateGuestSchema>;
