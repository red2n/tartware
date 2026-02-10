/**
 * Barrel re-export for backward compatibility.
 * Import directly from ./booking-config/ for new code.
 */
export {
  listAllotments,
  getAllotmentById,
  type ListAllotmentsInput,
  type GetAllotmentInput,
} from "./booking-config/allotment.js";
export {
  listBookingSources,
  getBookingSourceById,
  listMarketSegments,
  getMarketSegmentById,
  listChannelMappings,
  getChannelMappingById,
  type ListBookingSourcesInput,
  type GetBookingSourceInput,
  type ListMarketSegmentsInput,
  type GetMarketSegmentInput,
  type ListChannelMappingsInput,
  type GetChannelMappingInput,
} from "./booking-config/distribution.js";
export {
  listCompanies,
  getCompanyById,
  type ListCompaniesInput,
  type GetCompanyInput,
} from "./booking-config/company.js";
export {
  listMeetingRooms,
  getMeetingRoomById,
  listEventBookings,
  getEventBookingById,
  type ListMeetingRoomsInput,
  type GetMeetingRoomInput,
  type ListEventBookingsInput,
  type GetEventBookingInput,
} from "./booking-config/event.js";
export {
  listWaitlistEntries,
  getWaitlistEntryById,
  listGroupBookings,
  getGroupBookingById,
  listPromotionalCodes,
  getPromotionalCodeById,
  validatePromoCode,
  type ListWaitlistEntriesInput,
  type GetWaitlistEntryInput,
  type ListGroupBookingsInput,
  type GetGroupBookingInput,
  type ListPromotionalCodesInput,
  type GetPromotionalCodeInput,
  type ValidatePromoCodeInput,
} from "./booking-config/group-waitlist-promo.js";
