/**
 * DEV DOC
 * Module: events/commands/guests.ts
 * Description: Guest command schemas for registration, profile updates, loyalty, VIP, blacklist, GDPR, and preferences
 * Primary exports: GuestRegisterCommandSchema, GuestMergeCommandSchema, GuestUpdateProfileCommandSchema, GuestSetLoyaltyCommandSchema, GuestGdprEraseCommandSchema
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

const GuestAddressSchema = z
	.object({
		street: z.string().max(255).optional(),
		city: z.string().max(100).optional(),
		state: z.string().max(100).optional(),
		country: z.string().max(100).optional(),
		postal_code: z.string().max(20).optional(),
	})
	.optional();

const GuestPreferencesSchema = z
	.object({
		loyalty_tier: z.string().max(100).optional(),
		marketing_consent: z.boolean().optional(),
		vip_status: z.boolean().optional(),
		tags: z.array(z.string().max(50)).max(20).optional(),
		notes: z.string().max(2000).optional(),
	})
	.passthrough()
	.optional();

/** Reusable phone validation: 10–15 digits, optional leading +, with formatting chars. */
const PhoneSchema = z
	.string()
	.trim()
	.min(7)
	.max(25)
	.regex(
		/^\+?[\d\s()\-.]+$/,
		"Phone may only contain digits, spaces, +, -, (, ), and .",
	)
	.refine(
		(val) => {
			const digits = val.replace(/\D/g, "");
			return digits.length >= 10 && digits.length <= 15;
		},
		{ message: "Phone must contain 10–15 digits (e.g. +1 415-555-1234)" },
	);

export const GuestRegisterCommandSchema = z.object({
	first_name: z.string().trim().min(1).max(100),
	last_name: z.string().trim().min(1).max(100),
	email: z.string().email().max(255),
	phone: PhoneSchema.optional(),
	address: GuestAddressSchema,
	preferences: GuestPreferencesSchema,
	metadata: z.record(z.unknown()).optional(),
});

export type GuestRegisterCommand = z.infer<typeof GuestRegisterCommandSchema>;

export const GuestMergeCommandSchema = z
	.object({
		primary_guest_id: z.string().uuid(),
		duplicate_guest_id: z.string().uuid(),
		notes: z.string().max(2000).optional(),
		metadata: z.record(z.unknown()).optional(),
	})
	.refine(
		(value) => value.primary_guest_id !== value.duplicate_guest_id,
		"primary_guest_id and duplicate_guest_id must differ",
	);

export type GuestMergeCommand = z.infer<typeof GuestMergeCommandSchema>;

export const GuestUpdateProfileCommandSchema = z
	.object({
		guest_id: z.string().uuid(),
		first_name: z.string().trim().min(1).max(100).optional(),
		last_name: z.string().trim().min(1).max(100).optional(),
		email: z.string().email().max(255).optional(),
		phone: PhoneSchema.optional(),
		address: GuestAddressSchema,
		preferences: GuestPreferencesSchema,
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) =>
			Boolean(
				value.first_name ||
					value.last_name ||
					value.email ||
					value.phone ||
					value.address ||
					value.preferences,
			),
		"At least one profile field must be provided",
	);

export type GuestUpdateProfileCommand = z.infer<
	typeof GuestUpdateProfileCommandSchema
>;

export const GuestUpdateContactCommandSchema = z
	.object({
		guest_id: z.string().uuid(),
		email: z.string().email().max(255).optional(),
		phone: PhoneSchema.optional(),
		address: GuestAddressSchema,
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => Boolean(value.email || value.phone || value.address),
		"At least one contact field must be provided",
	);

export type GuestUpdateContactCommand = z.infer<
	typeof GuestUpdateContactCommandSchema
>;

export const GuestSetLoyaltyCommandSchema = z
	.object({
		guest_id: z.string().uuid(),
		loyalty_tier: z.string().max(100).optional(),
		points_delta: z.coerce.number().optional(),
		reason: z.string().max(500).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) =>
			Boolean(value.loyalty_tier || typeof value.points_delta === "number"),
		"loyalty_tier or points_delta is required",
	);

export type GuestSetLoyaltyCommand = z.infer<
	typeof GuestSetLoyaltyCommandSchema
>;

export const GuestSetVipCommandSchema = z.object({
	guest_id: z.string().uuid(),
	vip_status: z.boolean(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type GuestSetVipCommand = z.infer<typeof GuestSetVipCommandSchema>;

export const GuestSetBlacklistCommandSchema = z.object({
	guest_id: z.string().uuid(),
	is_blacklisted: z.boolean(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type GuestSetBlacklistCommand = z.infer<
	typeof GuestSetBlacklistCommandSchema
>;

export const GuestGdprEraseCommandSchema = z.object({
	guest_id: z.string().uuid(),
	requested_by: z.string().uuid().optional(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type GuestGdprEraseCommand = z.infer<typeof GuestGdprEraseCommandSchema>;

export const GuestPreferenceUpdateCommandSchema = z.object({
	guest_id: z.string().uuid(),
	preferences: GuestPreferencesSchema,
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type GuestPreferenceUpdateCommand = z.infer<
	typeof GuestPreferenceUpdateCommandSchema
>;
