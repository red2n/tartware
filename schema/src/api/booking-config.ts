/**
 * DEV DOC
 * Module: api/booking-config.ts
 * Purpose: Booking configuration API schemas (metasearch, promo codes)
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

// =====================================================
// METASEARCH CLICK PERFORMANCE
// =====================================================

/**
 * Metasearch click performance item schema for API responses.
 */
export const ClickPerformanceItemSchema = z.object({
	config_id: uuid,
	platform: z.string(),
	total_clicks: z.number(),
	total_cost: z.number(),
	total_conversions: z.number(),
	total_conversion_value: z.number(),
	conversion_rate_pct: z.number(),
	roas: z.number(),
});

export type ClickPerformanceItem = z.infer<typeof ClickPerformanceItemSchema>;

// =====================================================
// MEETING ROOM INPUTS
// =====================================================

/** Query parameters for listing meeting rooms. */
export type ListMeetingRoomsInput = {
	limit?: number;
	tenantId: string;
	propertyId?: string;
	roomType?: string;
	roomStatus?: string;
	isActive?: boolean;
	minCapacity?: number;
	offset?: number;
};

/** Query parameters for retrieving a single meeting room. */
export type GetMeetingRoomInput = {
	roomId: string;
	tenantId: string;
};

// =====================================================
// EVENT BOOKING INPUTS
// =====================================================

/** Query parameters for listing event bookings. */
export type ListEventBookingsInput = {
	limit?: number;
	tenantId: string;
	propertyId?: string;
	eventType?: string;
	bookingStatus?: string;
	eventDateFrom?: string;
	eventDateTo?: string;
	meetingRoomId?: string;
	offset?: number;
};

/** Query parameters for retrieving a single event booking. */
export type GetEventBookingInput = {
	eventId: string;
	tenantId: string;
};

// =====================================================
// BOOKING SOURCE INPUTS
// =====================================================

/** Query parameters for listing booking sources. */
export type ListBookingSourcesInput = {
	limit?: number;
	tenantId: string;
	propertyId?: string;
	sourceType?: string;
	isActive?: boolean;
	hasIntegration?: boolean;
	offset?: number;
};

/** Query parameters for retrieving a single booking source. */
export type GetBookingSourceInput = {
	sourceId: string;
	tenantId: string;
};

// =====================================================
// MARKET SEGMENT INPUTS
// =====================================================

/** Query parameters for listing market segments. */
export type ListMarketSegmentsInput = {
	limit?: number;
	tenantId: string;
	propertyId?: string;
	segmentType?: string;
	isActive?: boolean;
	parentSegmentId?: string;
	offset?: number;
};

/** Query parameters for retrieving a single market segment. */
export type GetMarketSegmentInput = {
	segmentId: string;
	tenantId: string;
};

// =====================================================
// CHANNEL MAPPING INPUTS
// =====================================================

/** Query parameters for listing channel mappings. */
export type ListChannelMappingsInput = {
	limit?: number;
	tenantId: string;
	propertyId?: string;
	channelCode?: string;
	entityType?: string;
	isActive?: boolean;
	offset?: number;
};

/** Query parameters for retrieving a single channel mapping. */
export type GetChannelMappingInput = {
	mappingId: string;
	tenantId: string;
};

// =====================================================
// ALLOTMENT INPUTS
// =====================================================

/** Query parameters for listing allotments (room blocks). */
export type ListAllotmentsInput = {
	limit?: number;
	tenantId: string;
	propertyId?: string;
	status?: string;
	allotmentType?: string;
	startDateFrom?: string;
	endDateTo?: string;
	offset?: number;
};

/** Query parameters for retrieving a single allotment. */
export type GetAllotmentInput = {
	allotmentId: string;
	tenantId: string;
};

// =====================================================
// COMPANY INPUTS
// =====================================================

/** Query parameters for listing companies (corporate accounts). */
export type ListCompaniesInput = {
	limit?: number;
	tenantId: string;
	companyType?: string;
	isActive?: boolean;
	creditStatus?: string;
	isBlacklisted?: boolean;
	offset?: number;
};

/** Query parameters for retrieving a single company record. */
export type GetCompanyInput = {
	companyId: string;
	tenantId: string;
};

// =====================================================
// WAITLIST ENTRY INPUTS
// =====================================================

/** Query parameters for listing waitlist entries. */
export type ListWaitlistEntriesInput = {
	limit?: number;
	tenantId: string;
	propertyId?: string;
	waitlistStatus?: string;
	arrivalDateFrom?: string;
	arrivalDateTo?: string;
	isVip?: boolean;
	offset?: number;
};

/** Query parameters for retrieving a single waitlist entry. */
export type GetWaitlistEntryInput = {
	waitlistId: string;
	tenantId: string;
};

// =====================================================
// GROUP BOOKING INPUTS
// =====================================================

/** Query parameters for listing group bookings (room blocks). */
export type ListGroupBookingsInput = {
	tenantId: string;
	propertyId?: string;
	blockStatus?: string;
	groupType?: string;
	arrivalDateFrom?: string;
	arrivalDateTo?: string;
	isActive?: boolean;
	limit?: number;
	offset?: number;
};

/** Query parameters for retrieving a single group booking. */
export type GetGroupBookingInput = {
	groupBookingId: string;
	tenantId: string;
};

// =====================================================
// PROMOTIONAL CODE INPUTS
// =====================================================

/** Query parameters for listing promotional codes. */
export type ListPromotionalCodesInput = {
	tenantId: string;
	propertyId?: string;
	promoStatus?: string;
	isActive?: boolean;
	isPublic?: boolean;
	search?: string;
	limit?: number;
	offset?: number;
};

/** Query parameters for retrieving a single promotional code. */
export type GetPromotionalCodeInput = {
	promoId: string;
	tenantId: string;
};

/** Parameters for validating a promotional code at booking time. */
export type ValidatePromoCodeInput = {
	promoCode: string;
	tenantId: string;
	propertyId?: string;
	arrivalDate: string;
	departureDate: string;
	roomTypeId?: string;
	rateCode?: string;
	bookingAmount?: number;
	guestId?: string;
	channel?: string;
};
