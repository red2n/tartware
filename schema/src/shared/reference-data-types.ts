/**
 * DEV DOC
 * Module: shared/reference-data-types.ts
 * Purpose: Shared schemas for lookup-table-backed reference data codes.
 * Ownership: Schema package
 */

import { z } from "zod";

const referenceDataCodePattern = /^[A-Z0-9_]{1,30}$/;
const referenceDataCodeMessage =
	"Code must be uppercase alphanumeric with underscores";

const createReferenceDataCodeSchema = () =>
	z
		.string()
		.trim()
		.min(1)
		.max(30)
		.toUpperCase()
		.regex(referenceDataCodePattern, {
			message: referenceDataCodeMessage,
		});

/**
 * Generic lookup-table code used by configurable reference data catalogs.
 */
export const ReferenceDataCodeSchema = createReferenceDataCodeSchema();

export type ReferenceDataCode = z.infer<typeof ReferenceDataCodeSchema>;

export const RoomCategoryCodeSchema = createReferenceDataCodeSchema();
export type RoomCategoryCode = z.infer<typeof RoomCategoryCodeSchema>;

export const RateTypeCodeSchema = createReferenceDataCodeSchema();
export type RateTypeCode = z.infer<typeof RateTypeCodeSchema>;

export const PaymentMethodCodeSchema = createReferenceDataCodeSchema();
export type PaymentMethodCode = z.infer<typeof PaymentMethodCodeSchema>;

export const CompanyTypeCodeSchema = createReferenceDataCodeSchema();
export type CompanyTypeCode = z.infer<typeof CompanyTypeCodeSchema>;

export const GroupBookingTypeCodeSchema = createReferenceDataCodeSchema();
export type GroupBookingTypeCode = z.infer<typeof GroupBookingTypeCodeSchema>;
