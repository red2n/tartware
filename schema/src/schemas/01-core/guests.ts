/**
 * Guest Schema - Guest profile and contact information
 * @table guests
 * @category 01-core
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import {
	uuid,
	tenantId as tenantIdBase,
	email,
	phoneNumber,
	countryCode,
	money,
	auditTimestamps,
	softDelete,
	jsonbMetadata,
	nonEmptyString,
	nonNegativeInt,
} from "../../shared/base-schemas.js";
import { validateGuestAge } from "../../shared/validators.js";

/**
 * Guest address JSONB schema
 */
export const GuestAddressSchema = z.object({
	street: z.string().default(""),
	city: z.string().default(""),
	state: z.string().default(""),
	postalCode: z.string().default(""),
	country: z.string().default(""),
});

/**
 * Guest preferences JSONB schema
 */
export const GuestPreferencesSchema = z.object({
	roomType: z.string().optional(),
	floor: z.string().optional(),
	bedType: z.enum(["KING", "QUEEN", "TWIN", "DOUBLE"]).optional(),
	smoking: z.boolean().default(false),
	language: z.string().length(2).default("en"),
	dietaryRestrictions: z.array(z.string()).default([]),
	specialRequests: z.array(z.string()).default([]),
});

/**
 * Communication preferences JSONB schema
 */
export const CommunicationPreferencesSchema = z.object({
	email: z.boolean().default(true),
	sms: z.boolean().default(false),
	phone: z.boolean().default(true),
	post: z.boolean().default(false),
});

/**
 * Complete Guest schema
 */
export const GuestSchema = z.object({
	id: uuid.describe("Primary key"),
	tenant_id: tenantIdBase.describe("Tenant reference"),
	first_name: nonEmptyString.max(100).describe("First name"),
	last_name: nonEmptyString.max(100).describe("Last name"),
	middle_name: z.string().max(100).optional().describe("Middle name"),
	title: z
		.enum(["Mr", "Mrs", "Ms", "Miss", "Dr", "Prof"])
		.optional()
		.describe("Title/salutation"),
	date_of_birth: z.coerce.date().optional().describe("Date of birth"),
	gender: z
		.enum(["Male", "Female", "Other", "Prefer not to say"])
		.optional()
		.describe("Gender"),
	nationality: countryCode.optional().describe("Nationality (ISO 3166-1)"),
	email: email.describe("Email address"),
	phone: phoneNumber.optional().describe("Primary phone"),
	secondary_phone: phoneNumber.optional().describe("Secondary phone"),
	address: GuestAddressSchema.describe("Mailing address"),
	id_type: z
		.enum(["passport", "drivers_license", "national_id", "other"])
		.optional()
		.describe("ID document type"),
	id_number: z.string().max(100).optional().describe("ID number"),
	passport_number: z.string().max(50).optional().describe("Passport number"),
	passport_expiry: z.coerce.date().optional().describe("Passport expiry date"),
	company_name: z.string().max(255).optional().describe("Company name"),
	company_tax_id: z.string().max(100).optional().describe("Company tax ID"),
	loyalty_tier: z
		.enum(["Bronze", "Silver", "Gold", "Platinum", "Diamond"])
		.optional()
		.describe("Loyalty program tier"),
	loyalty_points: nonNegativeInt.default(0).describe("Loyalty points balance"),
	vip_status: z.boolean().default(false).describe("VIP guest flag"),
	preferences: GuestPreferencesSchema.describe("Guest preferences"),
	marketing_consent: z.boolean().default(false).describe("Marketing consent"),
	communication_preferences: CommunicationPreferencesSchema.describe(
		"Communication preferences",
	),
	total_bookings: nonNegativeInt.default(0).describe("Lifetime booking count"),
	total_nights: nonNegativeInt.default(0).describe("Lifetime nights stayed"),
	total_revenue: money.default(0).describe("Lifetime revenue"),
	last_stay_date: z.coerce.date().optional().describe("Last stay date"),
	is_blacklisted: z.boolean().default(false).describe("Blacklist flag"),
	blacklist_reason: z.string().optional().describe("Blacklist reason"),
	notes: z.string().optional().describe("Internal notes"),
	metadata: jsonbMetadata,
	...auditTimestamps,
	...softDelete,
	version: z.bigint().default(BigInt(0)).describe("Optimistic locking version"),
});

export type Guest = z.infer<typeof GuestSchema>;

/**
 * Schema for creating a new guest
 */
export const CreateGuestSchema = GuestSchema.omit({
	id: true,
	total_bookings: true,
	total_nights: true,
	total_revenue: true,
	last_stay_date: true,
	created_at: true,
	updated_at: true,
	created_by: true,
	updated_by: true,
	deleted_at: true,
	version: true,
}).refine(
	(data) => {
		// Validate guest must be 18+ for check-in
		if (data.date_of_birth) {
			return validateGuestAge(data.date_of_birth);
		}
		return true;
	},
	{
		message: "Guest must be at least 18 years old",
		path: ["date_of_birth"],
	},
);

export type CreateGuest = z.infer<typeof CreateGuestSchema>;

/**
 * Schema for updating a guest
 */
export const UpdateGuestSchema = GuestSchema.omit({
	id: true,
	tenant_id: true, // Cannot change tenant
	total_bookings: true, // System calculated
	total_nights: true, // System calculated
	total_revenue: true, // System calculated
	last_stay_date: true, // System calculated
	created_at: true,
	created_by: true,
	deleted_at: true,
})
	.partial()
	.extend({
		id: uuid,
	});

export type UpdateGuest = z.infer<typeof UpdateGuestSchema>;

/**
 * Guest with statistics (for API responses)
 */
export const GuestWithStatsSchema = GuestSchema.extend({
	upcoming_reservations: z.number().int().nonnegative().optional(),
	past_reservations: z.number().int().nonnegative().optional(),
	cancelled_reservations: z.number().int().nonnegative().optional(),
	average_stay_length: z.number().nonnegative().optional(),
	preferred_room_types: z.array(z.string()).optional(),
	lifetime_value: z.number().nonnegative().optional(),
});

export type GuestWithStats = z.infer<typeof GuestWithStatsSchema>;

/**
 * Guest search/filter schema
 */
export const GuestSearchSchema = z.object({
	email: email.optional(),
	phone: phoneNumber.optional(),
	first_name: z.string().optional(),
	last_name: z.string().optional(),
	loyalty_tier: z.string().optional(),
	vip_status: z.boolean().optional(),
	is_blacklisted: z.boolean().optional(),
});

export type GuestSearch = z.infer<typeof GuestSearchSchema>;
