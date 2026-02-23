/**
 * Reservation Commands
 *
 * Domain-grouped command handlers for the reservation service.
 *
 *  ├─ Core          — create, modify, cancel, no-show, walk
 *  ├─ Checkin       — check-in, check-out, walk-in
 *  ├─ Room          — assign, unassign, extend stay
 *  ├─ Financial     — rate override, deposits
 *  ├─ Group         — group bookings, rooming lists, cutoffs
 *  ├─ OTA           — OTA sync, rate push, webhooks
 *  ├─ Waitlist      — add, convert, offer, expire
 *  ├─ Quote         — send, convert, expire quotes
 *  └─ Mobile        — registration card, mobile check-in flow
 */

export {
  checkInReservation,
  checkOutReservation,
  walkInCheckIn,
} from "./checkin-checkout.js";
export {
  batchNoShowSweep,
  cancelReservation,
  createReservation,
  markNoShow,
  modifyReservation,
  walkGuest,
} from "./core.js";
export {
  addDeposit,
  overrideRate,
  releaseDeposit,
} from "./financial-ops.js";
export {
  addGroupRooms,
  createGroupBooking,
  enforceGroupCutoff,
  setupGroupBilling,
  uploadGroupRoomingList,
} from "./group-booking.js";
export {
  createMetasearchConfig,
  recordMetasearchClick,
  updateMetasearchConfig,
} from "./metasearch.js";
export {
  completeMobileCheckin,
  generateRegistrationCard,
  startMobileCheckin,
} from "./mobile-checkin.js";
export {
  otaRatePush,
  otaSyncRequest,
  processOtaReservationQueue,
  updateIntegrationMapping,
  webhookRetry,
} from "./ota-integration.js";
export {
  convertQuote,
  expireReservation,
  sendQuote,
} from "./quote-management.js";
export {
  assignRoom,
  extendStay,
  unassignRoom,
} from "./room-assignment.js";
export {
  waitlistAdd,
  waitlistConvert,
  waitlistExpireSweep,
  waitlistOffer,
} from "./waitlist.js";
