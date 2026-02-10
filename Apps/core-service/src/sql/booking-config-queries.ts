// Barrel re-export — all SQL queries split into domain files
export { ALLOTMENT_LIST_SQL, ALLOTMENT_BY_ID_SQL } from "./booking-config/allotment.js";
export {
  BOOKING_SOURCE_LIST_SQL,
  BOOKING_SOURCE_BY_ID_SQL,
  MARKET_SEGMENT_LIST_SQL,
  MARKET_SEGMENT_BY_ID_SQL,
  CHANNEL_MAPPING_LIST_SQL,
  CHANNEL_MAPPING_BY_ID_SQL,
} from "./booking-config/distribution.js";
export { COMPANY_LIST_SQL, COMPANY_BY_ID_SQL } from "./booking-config/company.js";
export {
  MEETING_ROOM_LIST_SQL,
  MEETING_ROOM_BY_ID_SQL,
  EVENT_BOOKING_LIST_SQL,
  EVENT_BOOKING_BY_ID_SQL,
} from "./booking-config/event.js";
export {
  WAITLIST_ENTRY_LIST_SQL,
  WAITLIST_ENTRY_BY_ID_SQL,
  GROUP_BOOKING_LIST_SQL,
  GROUP_BOOKING_BY_ID_SQL,
  PROMOTIONAL_CODE_LIST_SQL,
  PROMOTIONAL_CODE_BY_ID_SQL,
  PROMOTIONAL_CODE_BY_CODE_SQL,
} from "./booking-config/group-waitlist-promo.js";
