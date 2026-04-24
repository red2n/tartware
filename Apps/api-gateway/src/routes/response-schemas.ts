/**
 * Pre-converted OpenAPI JSON schemas derived from @tartware/schemas Zod types.
 *
 * Each constant is the JSON Schema equivalent of the Zod schema, produced via
 * `schemaFromZod()`.  Route files import these directly into `response: { 200: ... }`.
 *
 * @module response-schemas
 */
import { schemaFromZod } from "@tartware/openapi";
import {
  AllotmentListResponseSchema,
  BillingPaymentListResponseSchema,
  BookingSourceListResponseSchema,
  ChannelMappingListResponseSchema,
  CheckInBriefSchema,
  CreatePropertyResponseSchema,
  GuestGridResponseSchema,
  HousekeepingTaskListResponseSchema,
  InvoiceListResponseSchema,
  LedgerEntryListResponseSchema,
  MarketSegmentListResponseSchema,
  NotificationListResponseSchema,
  ProgramBalanceResponseSchema,
  PropertyListResponseSchema,
  ReservationDetailSchema,
  ReservationGridResponseSchema,
  ReservationListResponseSchema,
  RoomGridResponseSchema,
  RoomListResponseSchema,
  RoomTypeGridResponseSchema,
  RoomTypeListResponseSchema,
  TenantScopedListResponseSchema,
  UnreadCountResponseSchema,
} from "@tartware/schemas";

// ─── Reservations ───────────────────────────────────────────────
export const reservationGridResponse = schemaFromZod(
  ReservationGridResponseSchema,
  "ReservationGridResponse",
);
export const reservationListResponse = schemaFromZod(
  ReservationListResponseSchema,
  "ReservationListResponse",
);
export const reservationDetailResponse = schemaFromZod(
  ReservationDetailSchema,
  "ReservationDetail",
);
export const checkInBriefResponse = schemaFromZod(CheckInBriefSchema, "CheckInBrief");

// ─── Guests ─────────────────────────────────────────────────────
export const guestGridResponse = schemaFromZod(GuestGridResponseSchema, "GuestGridResponse");
export const programBalanceResponse = schemaFromZod(ProgramBalanceResponseSchema, "ProgramBalance");

// ─── Rooms ──────────────────────────────────────────────────────
export const roomListResponse = schemaFromZod(RoomListResponseSchema, "RoomListResponse");
export const roomGridResponse = schemaFromZod(RoomGridResponseSchema, "RoomGridResponse");
export const roomTypeListResponse = schemaFromZod(
  RoomTypeListResponseSchema,
  "RoomTypeListResponse",
);
export const roomTypeGridResponse = schemaFromZod(
  RoomTypeGridResponseSchema,
  "RoomTypeGridResponse",
);

// ─── Billing ────────────────────────────────────────────────────
export const paymentListResponse = schemaFromZod(
  BillingPaymentListResponseSchema,
  "PaymentListResponse",
);
export const invoiceListResponse = schemaFromZod(InvoiceListResponseSchema, "InvoiceListResponse");
export const ledgerEntryListResponse = schemaFromZod(
  LedgerEntryListResponseSchema,
  "LedgerEntryListResponse",
);

// ─── Housekeeping ───────────────────────────────────────────────
export const housekeepingTaskListResponse = schemaFromZod(
  HousekeepingTaskListResponseSchema,
  "HousekeepingTaskListResponse",
);

// ─── Booking Config ─────────────────────────────────────────────
export const allotmentListResponse = schemaFromZod(
  AllotmentListResponseSchema,
  "AllotmentListResponse",
);
export const bookingSourceListResponse = schemaFromZod(
  BookingSourceListResponseSchema,
  "BookingSourceListResponse",
);
export const marketSegmentListResponse = schemaFromZod(
  MarketSegmentListResponseSchema,
  "MarketSegmentListResponse",
);
export const channelMappingListResponse = schemaFromZod(
  ChannelMappingListResponseSchema,
  "ChannelMappingListResponse",
);

// ─── Core / Tenants / Properties ────────────────────────────────
export const tenantListResponse = schemaFromZod(
  TenantScopedListResponseSchema,
  "TenantListResponse",
);
export const propertyListResponse = schemaFromZod(
  PropertyListResponseSchema,
  "PropertyListResponse",
);
export const createPropertyResponse = schemaFromZod(
  CreatePropertyResponseSchema,
  "CreatePropertyResponse",
);

// ─── Notifications ──────────────────────────────────────────────
export const notificationListResponse = schemaFromZod(
  NotificationListResponseSchema,
  "NotificationListResponse",
);
export const unreadCountResponse = schemaFromZod(UnreadCountResponseSchema, "UnreadCountResponse");
