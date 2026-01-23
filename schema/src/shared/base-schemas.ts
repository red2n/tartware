/**
 * DEV DOC
 * Module: shared/base-schemas.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

/**
 * Base Zod schemas for common Tartware database patterns
 * These reusable schemas enforce consistency across all table schemas
 */

import { z } from "zod";

/**
 * UUID pattern (PostgreSQL uuid type)
 * Validates RFC 4122 UUID format
 */
export const uuid = z.string().uuid({
	message: "Invalid UUID format",
});

/**
 * Tenant ID - Multi-tenant isolation key
 * Every tenant-scoped resource must include this
 */
export const tenantId = uuid.describe("Tenant isolation key for multi-tenancy");

/**
 * Property ID - Property-level isolation
 */
export const propertyId = uuid.describe("Property identifier within tenant");

/**
 * Audit timestamp fields
 * Standard audit trail for all mutable entities
 */
export const auditTimestamps = {
	created_at: z
		.date()
		.default(() => new Date())
		.describe("Timestamp when record was created"),
	updated_at: z
		.date()
		.optional()
		.describe("Timestamp when record was last updated"),
	created_by: uuid.optional().describe("User ID who created the record"),
	updated_by: uuid.optional().describe("User ID who last updated the record"),
};

/**
 * Soft delete pattern
 * Prefer soft deletes over hard deletes for audit trail
 */
export const softDelete = {
	is_deleted: z
		.boolean()
		.default(false)
		.describe("Soft delete flag (FALSE = active)"),
	deleted_at: z
		.date()
		.optional()
		.nullable()
		.describe("Timestamp when record was soft-deleted (NULL = active)"),
	deleted_by: z
		.string()
		.max(100)
		.optional()
		.nullable()
		.describe("User identifier who performed soft delete"),
};

/**
 * Money/Currency amount
 * Enforces 2 decimal places and non-negative values
 */
export const money = z
	.number()
	.multipleOf(0.01, { message: "Amount must have at most 2 decimal places" })
	.nonnegative({ message: "Amount cannot be negative" })
	.describe("Monetary amount with 2 decimal precision");

/**
 * Money amount that can be negative (e.g., refunds, adjustments)
 */
export const signedMoney = z
	.number()
	.multipleOf(0.01, { message: "Amount must have at most 2 decimal places" })
	.describe("Signed monetary amount with 2 decimal precision");

/**
 * Percentage value (0-100)
 */
export const percentage = z
	.number()
	.min(0, { message: "Percentage cannot be less than 0" })
	.max(100, { message: "Percentage cannot exceed 100" })
	.describe("Percentage value between 0 and 100");

/**
 * Decimal percentage (0-1) for rate calculations
 */
export const decimalPercentage = z
	.number()
	.min(0, { message: "Rate cannot be less than 0" })
	.max(1, { message: "Rate cannot exceed 1" })
	.describe("Decimal rate between 0 and 1");

/**
 * Email address
 */
export const email = z
	.string()
	.email({ message: "Invalid email address" })
	.toLowerCase()
	.trim()
	.describe("Email address");

/**
 * Phone number (international format)
 * Accepts various formats: +1234567890, +1-234-567-8900, etc.
 */
export const phoneNumber = z
	.string()
	.regex(/^\+?[1-9]\d{1,14}$/, {
		message:
			"Invalid phone number format (use international format: +1234567890)",
	})
	.describe("Phone number in international format");

/**
 * URL/URI pattern
 */
export const url = z
	.string()
	.url({ message: "Invalid URL format" })
	.describe("Valid URL");

/**
 * ISO 8601 date string
 */
export const isoDateString = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, {
		message: "Date must be in YYYY-MM-DD format",
	})
	.describe("ISO 8601 date string (YYYY-MM-DD)");

/**
 * ISO 8601 datetime string
 */
export const isoDateTimeString = z
	.string()
	.datetime({ message: "Invalid ISO 8601 datetime format" })
	.describe("ISO 8601 datetime string");

/**
 * JSONB metadata pattern
 * Flexible key-value store for extensibility
 */
export const jsonbMetadata = z
	.record(z.unknown())
	.optional()
	.describe("Flexible JSONB metadata object");

/**
 * JSONB settings pattern with typed structure
 */
export const jsonbSettings = z
	.object({})
	.passthrough()
	.optional()
	.describe("Structured JSONB settings object");

/**
 * Currency code (ISO 4217)
 */
export const currencyCode = z
	.string()
	.length(3)
	.toUpperCase()
	.regex(/^[A-Z]{3}$/, {
		message: "Currency code must be 3 uppercase letters (ISO 4217)",
	})
	.describe("ISO 4217 currency code (e.g., USD, EUR, GBP)");

/**
 * Country code (ISO 3166-1 alpha-2)
 */
export const countryCode = z
	.string()
	.length(2)
	.toUpperCase()
	.regex(/^[A-Z]{2}$/, {
		message: "Country code must be 2 uppercase letters (ISO 3166-1)",
	})
	.describe("ISO 3166-1 alpha-2 country code (e.g., US, GB, FR)");

/**
 * Language code (ISO 639-1)
 */
export const languageCode = z
	.string()
	.length(2)
	.toLowerCase()
	.regex(/^[a-z]{2}$/, {
		message: "Language code must be 2 lowercase letters (ISO 639-1)",
	})
	.describe("ISO 639-1 language code (e.g., en, fr, es)");

/**
 * Positive integer
 */
export const positiveInt = z
	.number()
	.int({ message: "Must be an integer" })
	.positive({ message: "Must be positive" })
	.describe("Positive integer");

/**
 * Non-negative integer (including 0)
 */
export const nonNegativeInt = z
	.number()
	.int({ message: "Must be an integer" })
	.nonnegative({ message: "Cannot be negative" })
	.describe("Non-negative integer");

/**
 * Latitude coordinate
 */
export const latitude = z
	.number()
	.min(-90, { message: "Latitude must be between -90 and 90" })
	.max(90, { message: "Latitude must be between -90 and 90" })
	.describe("Latitude coordinate (-90 to 90)");

/**
 * Longitude coordinate
 */
export const longitude = z
	.number()
	.min(-180, { message: "Longitude must be between -180 and 180" })
	.max(180, { message: "Longitude must be between -180 and 180" })
	.describe("Longitude coordinate (-180 to 180)");

/**
 * IP Address (v4 or v6)
 */
export const ipAddress = z
	.string()
	.ip({ message: "Invalid IP address" })
	.describe("IPv4 or IPv6 address");

/**
 * Non-empty trimmed string
 */
export const nonEmptyString = z
	.string()
	.trim()
	.min(1, { message: "Cannot be empty" })
	.describe("Non-empty string");

/**
 * Postal/ZIP code (flexible format for international support)
 */
export const postalCode = z
	.string()
	.trim()
	.min(3)
	.max(10)
	.regex(/^[A-Z0-9\s-]+$/i, { message: "Invalid postal code format" })
	.describe("Postal/ZIP code");

/**
 * Credit card last 4 digits (for PCI compliance)
 */
export const cardLast4 = z
	.string()
	.length(4)
	.regex(/^\d{4}$/, { message: "Must be exactly 4 digits" })
	.describe("Last 4 digits of card number");

/**
 * Expiry date (MM/YY format)
 */
export const expiryDate = z
	.string()
	.regex(/^(0[1-9]|1[0-2])\/\d{2}$/, {
		message: "Expiry date must be in MM/YY format",
	})
	.describe("Card expiry date (MM/YY)");

/**
 * Tax ID / VAT number (flexible format)
 */
export const taxId = z
	.string()
	.trim()
	.min(5)
	.max(20)
	.regex(/^[A-Z0-9-]+$/i, { message: "Invalid tax ID format" })
	.describe("Tax identification number");

/**
 * Rating (1-5 stars)
 */
export const starRating = z
	.number()
	.min(1, { message: "Rating must be at least 1" })
	.max(5, { message: "Rating cannot exceed 5" })
	.describe("Star rating (1-5)");

/**
 * NPS Score (-100 to 100)
 */
export const npsScore = z
	.number()
	.int()
	.min(-100, { message: "NPS score must be between -100 and 100" })
	.max(100, { message: "NPS score must be between -100 and 100" })
	.describe("Net Promoter Score (-100 to 100)");

/**
 * Room number (alphanumeric)
 */
export const roomNumber = z
	.string()
	.trim()
	.min(1)
	.max(20)
	.regex(/^[A-Z0-9-]+$/i, { message: "Room number must be alphanumeric" })
	.describe("Room number (e.g., 101, A-205)");

/**
 * Confirmation number / Booking reference
 */
export const confirmationNumber = z
	.string()
	.trim()
	.min(6)
	.max(20)
	.toUpperCase()
	.regex(/^[A-Z0-9-]+$/, {
		message: "Confirmation number must be alphanumeric",
	})
	.describe("Confirmation number (6-20 characters)");
