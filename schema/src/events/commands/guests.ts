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

export const GuestRegisterCommandSchema = z.object({
	first_name: z.string().trim().min(1).max(100),
	last_name: z.string().trim().min(1).max(100),
	email: z.string().email().max(255),
	phone: z.string().trim().min(3).max(25).optional(),
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
