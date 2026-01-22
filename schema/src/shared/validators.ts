/**
 * DEV DOC
 * Module: shared/validators.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

/**
 * Custom validation functions for Tartware PMS
 * Complex business rules and cross-field validations
 */

import { z } from "zod";

/**
 * Validate date range (end date must be after start date)
 */
export const validateDateRange = <
	T extends { start_date: Date; end_date: Date },
>(
	data: T,
	options?: { allowSameDay?: boolean; maxDays?: number },
): boolean => {
	const { start_date, end_date } = data;
	const { allowSameDay = false, maxDays } = options || {};

	// End must be after start (or equal if allowed)
	if (allowSameDay) {
		if (end_date < start_date) return false;
	} else {
		if (end_date <= start_date) return false;
	}

	// Check max duration if specified
	if (maxDays) {
		const daysDiff =
			(end_date.getTime() - start_date.getTime()) / (1000 * 60 * 60 * 24);
		if (daysDiff > maxDays) return false;
	}

	return true;
};

/**
 * Validate check-in/check-out dates for reservations
 */
export const validateStayDates = (checkIn: Date, checkOut: Date): boolean => {
	const now = new Date();
	now.setHours(0, 0, 0, 0); // Start of today

	// Check-in cannot be in the past
	if (checkIn < now) return false;

	// Check-out must be after check-in
	if (checkOut <= checkIn) return false;

	// Maximum stay duration (e.g., 365 days)
	const daysDiff =
		(checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24);
	if (daysDiff > 365) return false;

	return true;
};

/**
 * Validate credit card expiry date
 */
export const validateCardExpiry = (expiryDate: string): boolean => {
	const match = expiryDate.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
	if (!match) return false;

	const [, month, year] = match;
	if (!month || !year) return false;
	const expiry = new Date(2000 + parseInt(year, 10), parseInt(month, 10) - 1);
	const now = new Date();

	// Card must not be expired
	return expiry >= now;
};

/**
 * Validate email domain (optional whitelist/blacklist)
 */
export const validateEmailDomain = (
	email: string,
	options?: { whitelist?: string[]; blacklist?: string[] },
): boolean => {
	const domain = email.split("@")[1]?.toLowerCase();
	if (!domain) return false;

	const { whitelist, blacklist } = options || {};

	if (whitelist && whitelist.length > 0) {
		return whitelist.includes(domain);
	}

	if (blacklist && blacklist.length > 0) {
		return !blacklist.includes(domain);
	}

	return true;
};

/**
 * Validate percentage split (array of percentages must sum to 100)
 */
export const validatePercentageSplit = (percentages: number[]): boolean => {
	const sum = percentages.reduce((acc, val) => acc + val, 0);
	// Allow small floating point errors
	return Math.abs(sum - 100) < 0.01;
};

/**
 * Validate age (person must be at least minimum age)
 */
export const validateAge = (birthDate: Date, minAge: number): boolean => {
	const today = new Date();
	const age = today.getFullYear() - birthDate.getFullYear();
	const monthDiff = today.getMonth() - birthDate.getMonth();

	if (
		monthDiff < 0 ||
		(monthDiff === 0 && today.getDate() < birthDate.getDate())
	) {
		return age - 1 >= minAge;
	}

	return age >= minAge;
};

/**
 * Validate guest age (18+ for check-in)
 */
export const validateGuestAge = (birthDate: Date): boolean => {
	return validateAge(birthDate, 18);
};

/**
 * Validate that a value is within business hours
 */
export const validateBusinessHours = (
	time: Date,
	startHour: number = 9,
	endHour: number = 17,
): boolean => {
	const hour = time.getHours();
	return hour >= startHour && hour < endHour;
};

/**
 * Validate phone number format (international)
 */
export const validateInternationalPhone = (phone: string): boolean => {
	// E.164 format: +[country code][number]
	return /^\+[1-9]\d{1,14}$/.test(phone);
};

/**
 * Validate luhn algorithm (credit card validation)
 */
export const validateLuhn = (cardNumber: string): boolean => {
	const digits = cardNumber.replace(/\D/g, "");
	let sum = 0;
	let isEven = false;

	for (let i = digits.length - 1; i >= 0; i--) {
		const digitChar = digits[i];
		if (!digitChar) continue;
		let digit = parseInt(digitChar, 10);

		if (isEven) {
			digit *= 2;
			if (digit > 9) {
				digit -= 9;
			}
		}

		sum += digit;
		isEven = !isEven;
	}

	return sum % 10 === 0;
};

/**
 * Validate minimum stay duration
 */
export const validateMinimumStay = (
	checkIn: Date,
	checkOut: Date,
	minNights: number,
): boolean => {
	const nights =
		(checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24);
	return nights >= minNights;
};

/**
 * Validate maximum advance booking
 */
export const validateAdvanceBooking = (
	checkIn: Date,
	maxDaysInAdvance: number,
): boolean => {
	const now = new Date();
	const daysInAdvance =
		(checkIn.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
	return daysInAdvance <= maxDaysInAdvance;
};

/**
 * Validate rate amount (must be positive and reasonable)
 */
export const validateRateAmount = (
	amount: number,
	maxAmount: number = 100000,
): boolean => {
	return amount > 0 && amount <= maxAmount;
};

/**
 * Validate deposit percentage
 */
export const validateDepositPercentage = (percentage: number): boolean => {
	return percentage >= 0 && percentage <= 100;
};

/**
 * Validate cancellation deadline (must be before check-in)
 */
export const validateCancellationDeadline = (
	deadline: Date,
	checkIn: Date,
): boolean => {
	return deadline < checkIn;
};

/**
 * Zod refinement helper: Date range validation
 */
export const zodDateRangeRefinement = (
	message: string = "End date must be after start date",
) => ({
	validator: (data: { start_date: Date; end_date: Date }) =>
		data.end_date > data.start_date,
	message,
});

/**
 * Zod transform: Trim and lowercase string
 */
export const trimLowercase = z.string().trim().toLowerCase();

/**
 * Zod transform: Trim and uppercase string
 */
export const trimUppercase = z.string().trim().toUpperCase();

/**
 * Zod refinement: Non-empty array
 */
export const nonEmptyArray = <T>(schema: z.ZodType<T>) =>
	z.array(schema).min(1, { message: "Array cannot be empty" });

/**
 * Zod refinement: Unique array values
 */
export const uniqueArray = <T>(
	schema: z.ZodType<T>,
	message: string = "Duplicate values not allowed",
) =>
	z
		.array(schema)
		.refine((arr: T[]) => new Set(arr).size === arr.length, { message });
