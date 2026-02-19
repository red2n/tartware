# HTTP Test Coverage Audit

> Generated from a full comparison of all route handler files vs all `http_test/*.http` files.

---

## Summary

| Category | Count |
|----------|-------|
| Total registered endpoints (all services) | ~140 |
| Covered by http_test | ~100 |
| **UNCOVERED** | **~40** |

---

## UNCOVERED ENDPOINTS

### 1. Housekeeping Service — NEW Route Groups

These routes exist in the service but have **zero** test coverage:

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/housekeeping/schedules` | `Apps/housekeeping-service/src/routes/schedules.ts` |
| GET | `/v1/housekeeping/inspections` | `Apps/housekeeping-service/src/routes/inspections.ts` |

### 2. Core Service — Direct Booking Routes (Not Proxied)

Internal direct booking endpoints — distinct from guest self-service:

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/direct-booking/availability` | `Apps/core-service/src/routes/direct-booking.ts` |
| GET | `/v1/direct-booking/rate-quote` | `Apps/core-service/src/routes/direct-booking.ts` |
| POST | `/v1/direct-booking/book` | `Apps/core-service/src/routes/direct-booking.ts` |

### 3. Notification Service — Automated Messages (Entire Feature)

New feature with both read endpoints and gateway command-dispatch writes:

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/tenants/:tenantId/notifications/automated-messages` | `Apps/notification-service/src/routes/notifications.ts` |
| GET | `/v1/tenants/:tenantId/notifications/automated-messages/:messageId` | `Apps/notification-service/src/routes/notifications.ts` |
| POST | `/v1/tenants/:tenantId/notifications/automated-messages` | `Apps/api-gateway/src/routes/misc-routes.ts` (→ cmd: `notification.automated.create`) |
| PUT | `/v1/tenants/:tenantId/notifications/automated-messages/:messageId` | `Apps/api-gateway/src/routes/misc-routes.ts` (→ cmd: `notification.automated.update`) |
| DELETE | `/v1/tenants/:tenantId/notifications/automated-messages/:messageId` | `Apps/api-gateway/src/routes/misc-routes.ts` (→ cmd: `notification.automated.delete`) |

### 4. Rooms Service — Availability Search

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/rooms/availability` | `Apps/rooms-service/src/routes/rooms.ts` |

### 5. Settings Service — Category-Specific Catalog

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/settings/catalog/:categoryCode` | `Apps/settings-service/src/routes/catalog.ts` |

### 6. By-ID Detail Endpoints (List Covered, Detail Not)

These services register `GET /:id` detail routes that are tested at the list level only:

#### Core Service — Operations (by-ID)

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/cashier-sessions/:sessionId` | `Apps/core-service/src/routes/operations.ts` |
| GET | `/v1/shift-handovers/:handoverId` | `Apps/core-service/src/routes/operations.ts` |
| GET | `/v1/lost-and-found/:itemId` | `Apps/core-service/src/routes/operations.ts` |
| GET | `/v1/banquet-orders/:beoId` | `Apps/core-service/src/routes/operations.ts` |
| GET | `/v1/guest-feedback/:feedbackId` | `Apps/core-service/src/routes/operations.ts` |
| GET | `/v1/police-reports/:reportId` | `Apps/core-service/src/routes/operations.ts` |

#### Core Service — Compliance (by-ID)

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/compliance/breach-incidents/:incidentId` | `Apps/core-service/src/routes/compliance.ts` |

#### Core Service — Booking Config (by-ID)

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/allotments/:allotmentId` | `Apps/core-service/src/routes/booking-config/allotment.ts` |
| GET | `/v1/booking-sources/:sourceId` | `Apps/core-service/src/routes/booking-config/distribution.ts` |
| GET | `/v1/market-segments/:segmentId` | `Apps/core-service/src/routes/booking-config/distribution.ts` |
| GET | `/v1/channel-mappings/:mappingId` | `Apps/core-service/src/routes/booking-config/distribution.ts` |
| GET | `/v1/companies/:companyId` | `Apps/core-service/src/routes/booking-config/company.ts` |
| GET | `/v1/meeting-rooms/:roomId` | `Apps/core-service/src/routes/booking-config/event.ts` |
| GET | `/v1/event-bookings/:eventId` | `Apps/core-service/src/routes/booking-config/event.ts` |
| GET | `/v1/waitlist/:waitlistId` | `Apps/core-service/src/routes/booking-config/group-waitlist-promo.ts` |
| GET | `/v1/group-bookings/:groupBookingId` | `Apps/core-service/src/routes/booking-config/group-waitlist-promo.ts` |
| GET | `/v1/promo-codes/:promoId` | `Apps/core-service/src/routes/booking-config/group-waitlist-promo.ts` |

#### Guests Service (by-ID)

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/guests/:guestId` | `Apps/guests-service/src/routes/guests.ts` |

#### Billing Service (by-ID)

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/billing/invoices/:invoiceId` | `Apps/billing-service/src/routes/billing.ts` |
| GET | `/v1/billing/folios/:folioId` | `Apps/billing-service/src/routes/billing.ts` |
| GET | `/v1/billing/cashier-sessions/:sessionId` | `Apps/billing-service/src/routes/billing.ts` |
| GET | `/v1/billing/tax-configurations/:taxConfigId` | `Apps/billing-service/src/routes/billing.ts` |

#### Housekeeping Service (by-ID)

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/maintenance/requests/:requestId` | `Apps/housekeeping-service/src/routes/maintenance.ts` |
| GET | `/v1/incidents/:incidentId` | `Apps/housekeeping-service/src/routes/incidents.ts` |

#### Revenue Service (by-ID)

| Method | Path | Handler File |
|--------|------|-------------|
| GET | `/v1/revenue/pricing-rules/:ruleId` | `Apps/revenue-service/src/routes/pricing.ts` |

---

## FULL ROUTE INVENTORY BY SERVICE

### core-service (port 3000)

#### Auth — `Apps/core-service/src/routes/auth.ts`
| Method | Path | Covered |
|--------|------|---------|
| POST | `/v1/auth/login` | ✅ core-service.http |
| GET | `/v1/auth/context` | ✅ core-service.http |
| POST | `/v1/auth/change-password` | ✅ core-service.http |
| POST | `/v1/auth/mfa/enroll` | ✅ core-service.http |
| POST | `/v1/auth/mfa/verify` | ✅ core-service.http |
| POST | `/v1/auth/mfa/rotate` | ✅ core-service.http |

#### Users — `Apps/core-service/src/routes/users.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/users` | ✅ core-service.http |
| POST | `/v1/users` | ✅ core-service.http |
| POST | `/v1/users/reset-password` | ✅ core-service.http |

#### Tenants — `Apps/core-service/src/routes/tenants.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/tenants` | ✅ tenantandproperty.http |
| POST | `/v1/tenants/bootstrap` | ✅ tenantandproperty.http |

#### Properties — `Apps/core-service/src/routes/properties.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/properties` | ✅ tenantandproperty.http |
| POST | `/v1/properties` | ✅ tenantandproperty.http |

#### Modules — `Apps/core-service/src/routes/modules.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/modules/catalog` | ✅ modules.http |
| GET | `/v1/tenants/:tenantId/modules` | ✅ modules.http |

#### User-Tenant Associations — `Apps/core-service/src/routes/user-tenant-associations.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/user-tenant-associations` | ✅ core-service.http |
| POST | `/v1/user-tenant-associations/role` | ✅ core-service.http |
| POST | `/v1/user-tenant-associations/status` | ✅ core-service.http |

#### Dashboard — `Apps/core-service/src/routes/dashboard.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/dashboard/stats` | ✅ tenantandproperty.http |
| GET | `/v1/dashboard/activity` | ✅ tenantandproperty.http |
| GET | `/v1/dashboard/tasks` | ✅ tenantandproperty.http |

#### Reports — `Apps/core-service/src/routes/reports.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/reports/performance` | ✅ tenantandproperty.http |
| GET | `/v1/reports/occupancy` | ✅ reports.http |
| GET | `/v1/reports/revenue-kpis` | ✅ reports.http |
| GET | `/v1/reports/arrivals` | ✅ reports.http |
| GET | `/v1/reports/departures` | ✅ reports.http |
| GET | `/v1/reports/in-house` | ✅ reports.http |
| GET | `/v1/reports/demand-forecast` | ✅ reports.http |
| GET | `/v1/reports/pace` | ✅ reports.http |
| GET | `/v1/reports/revenue-forecast` | ✅ reports.http |

#### Reservations — `Apps/core-service/src/routes/reservations.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/reservations` | ✅ reservations.http |
| GET | `/v1/reservations/:id` | ✅ reservations.http |
| GET | `/v1/reservations/:id/check-in-brief` | ✅ reservations.http |

#### Operations — `Apps/core-service/src/routes/operations.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/cashier-sessions` | ✅ operations.http |
| GET | `/v1/cashier-sessions/:sessionId` | ❌ |
| GET | `/v1/shift-handovers` | ✅ operations.http |
| GET | `/v1/shift-handovers/:handoverId` | ❌ |
| GET | `/v1/lost-and-found` | ✅ operations.http |
| GET | `/v1/lost-and-found/:itemId` | ❌ |
| GET | `/v1/banquet-orders` | ✅ operations.http |
| GET | `/v1/banquet-orders/:beoId` | ❌ |
| GET | `/v1/guest-feedback` | ✅ operations.http |
| GET | `/v1/guest-feedback/:feedbackId` | ❌ |
| GET | `/v1/police-reports` | ✅ operations.http |
| GET | `/v1/police-reports/:reportId` | ❌ |

#### Compliance — `Apps/core-service/src/routes/compliance.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/compliance/breach-incidents` | ✅ operations.http |
| GET | `/v1/compliance/breach-incidents/:incidentId` | ❌ |
| POST | `/v1/compliance/breach-incidents` | ✅ operations.http |
| PUT | `/v1/compliance/breach-incidents/:incidentId/notify` | ✅ operations.http |

#### Night Audit — `Apps/core-service/src/routes/night-audit.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/night-audit/status` | ✅ night-audit.http |
| GET | `/v1/night-audit/history` | ✅ night-audit.http |
| GET | `/v1/night-audit/runs/:runId` | ✅ night-audit.http |
| GET | `/v1/ota-connections` | ✅ night-audit.http |
| GET | `/v1/ota-connections/:connectionId/sync-history` | ✅ night-audit.http |

#### Direct Booking — `Apps/core-service/src/routes/direct-booking.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/direct-booking/availability` | ❌ |
| GET | `/v1/direct-booking/rate-quote` | ❌ |
| POST | `/v1/direct-booking/book` | ❌ |

#### Booking Config — Allotments — `Apps/core-service/src/routes/booking-config/allotment.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/allotments` | ✅ booking-config.http |
| GET | `/v1/allotments/:allotmentId` | ❌ |

#### Booking Config — Companies — `Apps/core-service/src/routes/booking-config/company.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/companies` | ✅ booking-config.http |
| GET | `/v1/companies/:companyId` | ❌ |

#### Booking Config — Distribution — `Apps/core-service/src/routes/booking-config/distribution.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/booking-sources` | ✅ booking-config.http |
| GET | `/v1/booking-sources/:sourceId` | ❌ |
| GET | `/v1/market-segments` | ✅ booking-config.http |
| GET | `/v1/market-segments/:segmentId` | ❌ |
| GET | `/v1/channel-mappings` | ✅ booking-config.http |
| GET | `/v1/channel-mappings/:mappingId` | ❌ |

#### Booking Config — Events — `Apps/core-service/src/routes/booking-config/event.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/meeting-rooms` | ✅ booking-config.http |
| GET | `/v1/meeting-rooms/:roomId` | ❌ |
| GET | `/v1/event-bookings` | ✅ booking-config.http |
| GET | `/v1/event-bookings/:eventId` | ❌ |

#### Booking Config — Group/Waitlist/Promo — `Apps/core-service/src/routes/booking-config/group-waitlist-promo.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/waitlist` | ✅ booking-config.http |
| GET | `/v1/waitlist/:waitlistId` | ❌ |
| GET | `/v1/group-bookings` | ✅ night-audit.http |
| GET | `/v1/group-bookings/:groupBookingId` | ❌ |
| GET | `/v1/promo-codes` | ✅ night-audit.http |
| GET | `/v1/promo-codes/:promoId` | ❌ |
| POST | `/v1/promo-codes/validate` | ✅ night-audit.http |

#### System Auth — `Apps/core-service/src/routes/system-auth.ts`
| Method | Path | Covered |
|--------|------|---------|
| POST | `/v1/system/auth/login` | ✅ tenantandproperty.http |
| POST | `/v1/system/auth/break-glass` | ✅ tenantandproperty.http |

#### System Tenants — `Apps/core-service/src/routes/system-tenants.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/system/tenants` | ✅ tenantandproperty.http |
| POST | `/v1/system/tenants` | ✅ tenantandproperty.http |
| POST | `/v1/system/tenants/bootstrap` | ✅ tenantandproperty.http |

#### System Users — `Apps/core-service/src/routes/system-users.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/system/users` | ✅ tenantandproperty.http |
| POST | `/v1/system/users` | ✅ tenantandproperty.http |

#### System Impersonation — `Apps/core-service/src/routes/system-impersonation.ts`
| Method | Path | Covered |
|--------|------|---------|
| POST | `/v1/system/impersonate` | ✅ tenantandproperty.http |

---

### rooms-service (port 3015)

#### Room Types — `Apps/rooms-service/src/routes/room-types.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/room-types` | ✅ rooms.http |
| POST | `/v1/room-types` | ✅ rooms.http |
| PUT | `/v1/room-types/:roomTypeId` | ✅ rooms.http |
| DELETE | `/v1/room-types/:roomTypeId` | ✅ rooms.http |

#### Rooms — `Apps/rooms-service/src/routes/rooms.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/rooms` | ✅ rooms.http |
| GET | `/v1/rooms/:roomId` | ✅ rooms.http |
| POST | `/v1/rooms` | ✅ rooms.http |
| PUT | `/v1/rooms/:roomId` | ✅ rooms.http |
| DELETE | `/v1/rooms/:roomId` | ✅ rooms.http |
| GET | `/v1/rooms/availability` | ❌ |

#### Rates — `Apps/rooms-service/src/routes/rates.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/rates` | ✅ rates.http |
| GET | `/v1/rates/:rateId` | ✅ rates.http |
| POST | `/v1/rates` | ✅ rates.http |
| PUT | `/v1/rates/:rateId` | ✅ rates.http |
| DELETE | `/v1/rates/:rateId` | ✅ rates.http |

---

### billing-service (port 3025)

#### Billing — `Apps/billing-service/src/routes/billing.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/billing/payments` | ✅ billing.http |
| GET | `/v1/billing/invoices` | ✅ billing.http |
| GET | `/v1/billing/invoices/:invoiceId` | ❌ |
| GET | `/v1/billing/folios` | ✅ billing.http |
| GET | `/v1/billing/folios/:folioId` | ❌ |
| GET | `/v1/billing/charges` | ✅ billing.http |
| GET | `/v1/billing/cashier-sessions` | ✅ billing.http |
| GET | `/v1/billing/cashier-sessions/:sessionId` | ❌ |
| GET | `/v1/billing/tax-configurations` | ✅ billing.http |
| GET | `/v1/billing/tax-configurations/:taxConfigId` | ❌ |

---

### housekeeping-service (port 3030)

#### Housekeeping Tasks — `Apps/housekeeping-service/src/routes/housekeeping.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/housekeeping/tasks` | ✅ housekeeping.http |

#### Deep Clean — `Apps/housekeeping-service/src/routes/deep-clean.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/housekeeping/deep-clean-due` | ✅ housekeeping.http |

#### Schedules — `Apps/housekeeping-service/src/routes/schedules.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/housekeeping/schedules` | ❌ |

#### Inspections — `Apps/housekeeping-service/src/routes/inspections.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/housekeeping/inspections` | ❌ |

#### Maintenance — `Apps/housekeeping-service/src/routes/maintenance.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/maintenance/requests` | ✅ operations.http |
| GET | `/v1/maintenance/requests/:requestId` | ❌ |

#### Incidents — `Apps/housekeeping-service/src/routes/incidents.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/incidents` | ✅ operations.http |
| GET | `/v1/incidents/:incidentId` | ❌ |

---

### guests-service (port 3010)

#### Guests — `Apps/guests-service/src/routes/guests.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/guests` | ✅ guests.http |
| GET | `/v1/guests/:guestId` | ❌ |
| GET | `/v1/guests/:guestId/preferences` | ✅ guests.http |
| GET | `/v1/guests/:guestId/documents` | ✅ guests.http |
| GET | `/v1/guests/:guestId/communications` | ✅ guests.http |

---

### settings-service (port 3005)

#### Catalog — `Apps/settings-service/src/routes/catalog.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/settings/catalog` | ✅ settings-service.http |
| GET | `/v1/settings/categories` | ✅ settings-service.http |
| GET | `/v1/settings/sections` | ✅ settings-service.http |
| GET | `/v1/settings/definitions` | ✅ settings-service.http |
| GET | `/v1/settings/options` | ✅ settings-service.http |
| GET | `/v1/settings/catalog/:categoryCode` | ❌ |
| GET | `/v1/settings/values` | ✅ settings-service.http |
| POST | `/v1/settings/values` | ✅ settings-service.http |
| PATCH | `/v1/settings/values/:valueId` | ✅ settings-service.http |

#### Amenities — `Apps/settings-service/src/routes/amenities.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/settings/properties/:propertyId/amenities` | ✅ settings-service.http |
| POST | `/v1/settings/properties/:propertyId/amenities` | ✅ settings-service.http |
| PUT | `/v1/settings/properties/:propertyId/amenities/:amenityCode` | ✅ settings-service.http |

#### Packages — `Apps/settings-service/src/routes/packages.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/packages` | ✅ settings-service.http |
| GET | `/v1/packages/:packageId` | ✅ settings-service.http |
| GET | `/v1/packages/:packageId/components` | ✅ settings-service.http |

---

### command-center-service (port 3035)

#### Commands — `Apps/command-center-service/src/routes/commands.ts`
| Method | Path | Covered |
|--------|------|---------|
| POST | `/v1/commands/:commandName/execute` | ✅ command-center.http (79 commands) |

---

### recommendation-service (port 3040)

#### Recommendations — `Apps/recommendation-service/src/routes/recommendations.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/recommendations` | ✅ recommendations.http |
| POST | `/v1/recommendations/rank` | ✅ recommendations.http |

---

### availability-guard-service (port 3045)

#### Locks — `Apps/availability-guard-service/src/routes/locks.ts`
| Method | Path | Covered |
|--------|------|---------|
| POST | `/v1/locks` | ✅ availability-guard.http |
| DELETE | `/v1/locks/:lockId` | ✅ availability-guard.http |
| POST | `/v1/locks/bulk-release` | ✅ availability-guard.http |
| POST | `/v1/locks/:lockId/manual-release` | ✅ availability-guard.http |
| GET | `/v1/locks/:lockId/audit` | ✅ availability-guard.http |
| GET | `/v1/locks/audit` | ✅ availability-guard.http |
| POST | `/v1/notifications/manual-release/test` | ✅ availability-guard.http |

---

### notification-service (port 3055)

#### Notifications — `Apps/notification-service/src/routes/notifications.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/tenants/:tenantId/notifications/templates` | ✅ notifications.http |
| GET | `/v1/tenants/:tenantId/notifications/templates/:templateId` | ✅ notifications.http |
| GET | `/v1/tenants/:tenantId/notifications/guests/:guestId/communications` | ✅ notifications.http |
| GET | `/v1/tenants/:tenantId/notifications/communications/:communicationId` | ✅ notifications.http |
| GET | `/v1/tenants/:tenantId/notifications/automated-messages` | ❌ |
| GET | `/v1/tenants/:tenantId/notifications/automated-messages/:messageId` | ❌ |

---

### revenue-service (port 3060)

#### Pricing — `Apps/revenue-service/src/routes/pricing.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/revenue/pricing-rules` | ✅ revenue.http |
| GET | `/v1/revenue/pricing-rules/:ruleId` | ❌ |
| GET | `/v1/revenue/rate-recommendations` | ✅ revenue.http |
| GET | `/v1/revenue/competitor-rates` | ✅ revenue.http |
| GET | `/v1/revenue/demand-calendar` | ✅ revenue.http |

#### Reports — `Apps/revenue-service/src/routes/reports.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/revenue/forecasts` | ✅ revenue.http |
| GET | `/v1/revenue/goals` | ✅ revenue.http |
| GET | `/v1/revenue/kpis` | ✅ revenue.http |
| GET | `/v1/revenue/compset-indices` | ✅ revenue.http |

---

### guest-experience-service (port 3065)

#### Booking — `Apps/guest-experience-service/src/routes/booking.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/self-service/search` | ✅ self-service.http |
| POST | `/v1/self-service/book` | ✅ self-service.http |
| GET | `/v1/self-service/booking/:confirmationCode` | ✅ self-service.http |

#### Check-in — `Apps/guest-experience-service/src/routes/checkin.ts`
| Method | Path | Covered |
|--------|------|---------|
| POST | `/v1/self-service/check-in/start` | ✅ self-service.http |
| POST | `/v1/self-service/check-in/:checkinId/complete` | ✅ self-service.http |
| GET | `/v1/self-service/check-in/:checkinId` | ✅ self-service.http |

#### Registration Card — `Apps/guest-experience-service/src/routes/registration-card.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/self-service/registration-card/:reservationId` | ✅ self-service.http |
| GET | `/v1/self-service/registration-card/:reservationId/html` | ✅ self-service.http |

#### Keys — `Apps/guest-experience-service/src/routes/keys.ts`
| Method | Path | Covered |
|--------|------|---------|
| GET | `/v1/self-service/keys/:reservationId` | ✅ self-service.http |

---

### API Gateway Command-Dispatch Routes (port 8080)

#### Notification Commands — `Apps/api-gateway/src/routes/misc-routes.ts`
| Method | Path | Command | Covered |
|--------|------|---------|---------|
| POST | `/v1/tenants/:tenantId/notifications/templates` | `notification.template.create` | ✅ notifications.http |
| PUT | `/v1/tenants/:tenantId/notifications/templates/:templateId` | `notification.template.update` | ✅ notifications.http |
| DELETE | `/v1/tenants/:tenantId/notifications/templates/:templateId` | `notification.template.delete` | ✅ notifications.http |
| POST | `/v1/tenants/:tenantId/notifications/send` | `notification.send` | ✅ notifications.http |
| POST | `/v1/tenants/:tenantId/notifications/automated-messages` | `notification.automated.create` | ❌ |
| PUT | `/v1/tenants/:tenantId/notifications/automated-messages/:messageId` | `notification.automated.update` | ❌ |
| DELETE | `/v1/tenants/:tenantId/notifications/automated-messages/:messageId` | `notification.automated.delete` | ❌ |

#### Generic Command Dispatch — `Apps/api-gateway/src/routes/misc-routes.ts`
| Method | Path | Covered |
|--------|------|---------|
| POST | `/v1/tenants/:tenantId/commands/:commandName` | ✅ (implicit via command-center.http + REST dispatch tests) |
