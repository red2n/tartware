/**
 * DEV DOC
 * Module: api/operations.ts
 * Purpose: Input/output types for hotel operations service queries —
 *          cashier sessions, shift handovers, lost & found, banquet orders,
 *          guest feedback, police reports, night audit, OTA connections.
 * Ownership: Schema package
 */

// =====================================================
// CASHIER SESSION INPUTS
// =====================================================

/** Query parameters for listing cashier sessions. */
export type ListCashierSessionsInput = {
	tenantId: string;
	propertyId?: string;
	sessionStatus?: string;
	businessDate?: string;
	cashierId?: string;
	limit?: number;
	offset?: number;
};

/** Query parameters for retrieving a single cashier session. */
export type GetCashierSessionInput = {
	sessionId: string;
	tenantId: string;
};

// =====================================================
// SHIFT HANDOVER INPUTS
// =====================================================

/** Query parameters for listing shift handover records. */
export type ListShiftHandoversInput = {
	tenantId: string;
	propertyId?: string;
	handoverStatus?: string;
	shiftDate?: string;
	department?: string;
	limit?: number;
	offset?: number;
};

/** Query parameters for retrieving a single shift handover. */
export type GetShiftHandoverInput = {
	handoverId: string;
	tenantId: string;
};

// =====================================================
// LOST AND FOUND INPUTS
// =====================================================

/** Query parameters for listing lost and found items. */
export type ListLostFoundInput = {
	tenantId: string;
	propertyId?: string;
	itemStatus?: string;
	itemCategory?: string;
	foundDateFrom?: string;
	limit?: number;
	offset?: number;
};

/** Query parameters for retrieving a single lost and found item. */
export type GetLostFoundInput = {
	itemId: string;
	tenantId: string;
};

// =====================================================
// BANQUET ORDER INPUTS
// =====================================================

/** Query parameters for listing banquet event orders (BEOs). */
export type ListBanquetOrdersInput = {
	tenantId: string;
	propertyId?: string;
	beoStatus?: string;
	eventDate?: string;
	meetingRoomId?: string;
	limit?: number;
	offset?: number;
};

/** Query parameters for retrieving a single banquet event order. */
export type GetBanquetOrderInput = {
	beoId: string;
	tenantId: string;
};

// =====================================================
// GUEST FEEDBACK INPUTS
// =====================================================

/** Query parameters for listing guest feedback records. */
export type ListGuestFeedbackInput = {
	tenantId: string;
	propertyId?: string;
	sentimentLabel?: string;
	isPublic?: boolean;
	hasResponse?: boolean;
	limit?: number;
	offset?: number;
};

/** Query parameters for retrieving a single guest feedback record. */
export type GetGuestFeedbackInput = {
	feedbackId: string;
	tenantId: string;
};

// =====================================================
// POLICE REPORT INPUTS
// =====================================================

/** Query parameters for listing police reports. */
export type ListPoliceReportsInput = {
	tenantId: string;
	propertyId?: string;
	reportStatus?: string;
	incidentType?: string;
	incidentDateFrom?: string;
	limit?: number;
	offset?: number;
};

/** Query parameters for retrieving a single police report. */
export type GetPoliceReportInput = {
	reportId: string;
	tenantId: string;
};

// =====================================================
// NIGHT AUDIT INPUTS
// =====================================================

/** Query parameters for retrieving the current business date status. */
export type GetBusinessDateStatusInput = {
	tenantId: string;
	propertyId: string;
};

/** Query parameters for listing night audit run history. */
export type ListNightAuditHistoryInput = {
	tenantId: string;
	propertyId?: string;
	limit?: number;
	offset?: number;
};

/** Query parameters for retrieving night audit run detail with steps. */
export type GetNightAuditRunDetailInput = {
	runId: string;
	tenantId: string;
};

// =====================================================
// OTA CONNECTION INPUTS
// =====================================================

/** Query parameters for listing OTA channel connections. */
export type ListOtaConnectionsInput = {
	tenantId: string;
	propertyId?: string;
	connectionStatus?: string;
	isActive?: boolean;
	limit?: number;
	offset?: number;
};

/** Query parameters for listing OTA sync history logs. */
export type ListOtaSyncLogsInput = {
	connectionId: string;
	tenantId: string;
	limit?: number;
	offset?: number;
};

/** Query parameters for listing the business date calendar. */
export type ListBusinessCalendarInput = {
	tenantId: string;
	propertyId?: string;
	limit?: number;
	offset?: number;
};
