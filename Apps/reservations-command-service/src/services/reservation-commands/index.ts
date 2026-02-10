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
  ReservationCommandError,
  type CreateReservationResult,
  DEFAULT_CURRENCY,
  APP_ACTOR,
  SYSTEM_ACTOR_ID,
  type ReservationUpdatePayload,
  enqueueReservationUpdate,
  type RoomInfo,
  fetchRoomInfo,
  findBestAvailableRoom,
  buildReservationUpdatePayload,
  hasStayCriticalChanges,
} from "./common.js";

export {
  createReservation,
  modifyReservation,
  cancelReservation,
  markNoShow,
  batchNoShowSweep,
  walkGuest,
} from "./core.js";

export {
  checkInReservation,
  checkOutReservation,
  walkInCheckIn,
} from "./checkin-checkout.js";

export {
  assignRoom,
  unassignRoom,
  extendStay,
} from "./room-assignment.js";

export {
  overrideRate,
  addDeposit,
  releaseDeposit,
} from "./financial-ops.js";

export {
  createGroupBooking,
  addGroupRooms,
  uploadGroupRoomingList,
  enforceGroupCutoff,
  setupGroupBilling,
} from "./group-booking.js";

export {
  otaSyncRequest,
  otaRatePush,
  webhookRetry,
  updateIntegrationMapping,
  processOtaReservationQueue,
} from "./ota-integration.js";

export {
  waitlistAdd,
  waitlistConvert,
  waitlistOffer,
  waitlistExpireSweep,
} from "./waitlist.js";

export {
  sendQuote,
  convertQuote,
  expireReservation,
} from "./quote-management.js";

export {
  generateRegistrationCard,
  startMobileCheckin,
  completeMobileCheckin,
} from "./mobile-checkin.js";
