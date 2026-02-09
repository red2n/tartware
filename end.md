All data collected. Here's the complete audit:

---

## Comprehensive HTTP Endpoint Audit — All 22 Apps

### Library Packages (No HTTP Endpoints)

| # | Package | Purpose |
|---|---------|---------|
| 1 | `candidate-pipeline` | Room candidate filtering/hydration pipeline |
| 2 | `command-center-shared` | Shared command center repositories/services |
| 3 | `command-consumer-utils` | Kafka consumer utilities |
| 4 | `config` | Shared configuration module |
| 5 | `fastify-server` | Shared Fastify server builder |
| 6 | `openapi-utils` | OpenAPI schema generation utilities |
| 7 | `outbox` | Transactional outbox pattern implementation |
| 8 | `telemetry` | OpenTelemetry instrumentation |
| 9 | `tenant-auth` | Tenant authentication/authorization |

---

### Services with HTTP Endpoints

#### 1. api-gateway (port 8080)
**Route file:** [src/server.ts](Apps/api-gateway/src/server.ts)

| Method | Path | Type |
|--------|------|------|
| `OPTIONS` | `/health` | direct |
| `GET` | `/health` | direct |
| `GET` | `/ready` | direct |
| **Reservations** | | |
| `GET` | `/v1/reservations` | proxy → core |
| `GET` | `/v1/reservations/:id` | proxy → core |
| `ALL` | `/v1/tenants/:tenantId/reservations` | proxy/command |
| `ALL` | `/v1/tenants/:tenantId/reservations/*` | proxy/command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/cancel` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/check-in` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/check-out` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/assign-room` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/unassign-room` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/extend` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/rate-override` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/deposit/add` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/deposit/release` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/:reservationId/no-show` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/walk-in` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/waitlist` | command |
| `POST` | `/v1/tenants/:tenantId/reservations/waitlist/:waitlistId/convert` | command |
| **Auth & System** | | |
| `ALL` | `/v1/auth` | proxy → core |
| `ALL` | `/v1/auth/*` | proxy → core |
| `ALL` | `/v1/system/*` | proxy → core |
| **Commands** | | |
| `ALL` | `/v1/commands` | proxy → command-center |
| `ALL` | `/v1/commands/*` | proxy → command-center |
| `POST` | `/v1/tenants/:tenantId/commands/:commandName` | command dispatch |
| **Tenants & Properties** | | |
| `GET` | `/v1/tenants` | proxy → core |
| `GET` | `/v1/properties` | proxy → core |
| `POST` | `/v1/properties` | proxy → core |
| `ALL` | `/v1/properties/*` | proxy → core |
| **Dashboard & Reports** | | |
| `ALL` | `/v1/dashboard/*` | proxy → core |
| `ALL` | `/v1/reports/*` | proxy → core |
| **Modules** | | |
| `GET` | `/v1/modules/catalog` | proxy → core |
| `ALL` | `/v1/tenants/:tenantId/modules` | proxy → core |
| **Rooms** | | |
| `GET` | `/v1/rooms` | proxy → rooms |
| `POST` | `/v1/rooms` | proxy → rooms |
| `ALL` | `/v1/rooms/*` | proxy → rooms |
| `POST` | `/v1/tenants/:tenantId/rooms/:roomId/block` | command |
| `POST` | `/v1/tenants/:tenantId/rooms/:roomId/release` | command |
| `POST` | `/v1/tenants/:tenantId/rooms/:roomId/status` | command |
| `POST` | `/v1/tenants/:tenantId/rooms/:roomId/housekeeping-status` | command |
| `POST` | `/v1/tenants/:tenantId/rooms/:roomId/out-of-order` | command |
| `POST` | `/v1/tenants/:tenantId/rooms/:roomId/out-of-service` | command |
| `POST` | `/v1/tenants/:tenantId/rooms/:roomId/features` | command |
| **Room Types** | | |
| `GET` | `/v1/room-types` | proxy → rooms |
| `POST` | `/v1/room-types` | proxy → rooms |
| `GET` | `/v1/room-types/*` | proxy → rooms |
| `PUT` | `/v1/room-types/*` | proxy → rooms |
| `PATCH` | `/v1/room-types/*` | proxy → rooms |
| `DELETE` | `/v1/room-types/*` | proxy → rooms |
| **Rates** | | |
| `GET` | `/v1/rates` | proxy → rooms |
| `POST` | `/v1/rates` | proxy → rooms |
| `ALL` | `/v1/rates/*` | proxy → rooms |
| **Guests** | | |
| `GET` | `/v1/guests` | proxy → guests |
| `POST` | `/v1/guests` | command: guest.register |
| `POST` | `/v1/guests/merge` | command: guest.merge |
| `POST` | `/v1/tenants/:tenantId/guests/:guestId/profile` | command |
| `POST` | `/v1/tenants/:tenantId/guests/:guestId/contact` | command |
| `POST` | `/v1/tenants/:tenantId/guests/:guestId/loyalty` | command |
| `POST` | `/v1/tenants/:tenantId/guests/:guestId/vip` | command |
| `POST` | `/v1/tenants/:tenantId/guests/:guestId/blacklist` | command |
| `POST` | `/v1/tenants/:tenantId/guests/:guestId/gdpr-erase` | command |
| `POST` | `/v1/tenants/:tenantId/guests/:guestId/preferences` | command |
| `GET` | `/v1/guests/*` | proxy → guests |
| **Housekeeping** | | |
| `GET` | `/v1/housekeeping/tasks` | proxy → housekeeping |
| `GET` | `/v1/housekeeping/*` | proxy → housekeeping |
| `POST` | `/v1/tenants/:tenantId/housekeeping/tasks` | command |
| `POST` | `/v1/tenants/:tenantId/housekeeping/tasks/:taskId/assign` | command |
| `POST` | `/v1/tenants/:tenantId/housekeeping/tasks/:taskId/complete` | command |
| `POST` | `/v1/tenants/:tenantId/housekeeping/tasks/:taskId/reassign` | command |
| `POST` | `/v1/tenants/:tenantId/housekeeping/tasks/:taskId/reopen` | command |
| `POST` | `/v1/tenants/:tenantId/housekeeping/tasks/:taskId/notes` | command |
| `POST` | `/v1/tenants/:tenantId/housekeeping/tasks/bulk-status` | command |
| **Billing** | | |
| `GET` | `/v1/billing/payments` | proxy → billing |
| `GET` | `/v1/billing/*` | proxy → billing |
| `POST` | `/v1/tenants/:tenantId/billing/payments/capture` | command |
| `POST` | `/v1/tenants/:tenantId/billing/payments/:paymentId/refund` | command |
| `POST` | `/v1/tenants/:tenantId/billing/payments/:paymentId/apply` | command |
| `POST` | `/v1/tenants/:tenantId/billing/payments/:paymentId/void` | command |
| `POST` | `/v1/tenants/:tenantId/billing/invoices` | command |
| `POST` | `/v1/tenants/:tenantId/billing/invoices/:invoiceId/adjust` | command |
| `POST` | `/v1/tenants/:tenantId/billing/charges` | command |
| `POST` | `/v1/tenants/:tenantId/billing/folios/transfer` | command |
| `POST` | `/v1/tenants/:tenantId/billing/folios/close` | command |
| **Recommendations** | | |
| `GET` | `/v1/recommendations` | proxy → recommendations |
| `POST` | `/v1/recommendations/rank` | proxy → recommendations |
| `ALL` | `/v1/recommendations/*` | proxy → recommendations |
| **Notifications** | | |
| `GET` | `/v1/tenants/:tenantId/notifications/templates` | proxy → notifications |
| `GET` | `/v1/tenants/:tenantId/notifications/templates/:templateId` | proxy → notifications |
| `POST` | `/v1/tenants/:tenantId/notifications/templates` | command |
| `PUT` | `/v1/tenants/:tenantId/notifications/templates/:templateId` | command |
| `DELETE` | `/v1/tenants/:tenantId/notifications/templates/:templateId` | command |
| `POST` | `/v1/tenants/:tenantId/notifications/send` | command |
| `GET` | `/v1/tenants/:tenantId/notifications/guests/:guestId/communications` | proxy |
| `GET` | `/v1/tenants/:tenantId/notifications/communications/:communicationId` | proxy |
| **Settings** | | |
| `ALL` | `/v1/settings` | proxy → settings |
| `ALL` | `/v1/settings/*` | proxy → settings |
| **Booking Config (core proxies)** | | |
| `GET` | `/v1/allotments` | proxy → core |
| `ALL` | `/v1/allotments/*` | proxy → core |
| `GET` | `/v1/booking-sources` | proxy → core |
| `ALL` | `/v1/booking-sources/*` | proxy → core |
| `GET` | `/v1/market-segments` | proxy → core |
| `ALL` | `/v1/market-segments/*` | proxy → core |
| `GET` | `/v1/channel-mappings` | proxy → core |
| `ALL` | `/v1/channel-mappings/*` | proxy → core |
| `GET` | `/v1/companies` | proxy → core |
| `ALL` | `/v1/companies/*` | proxy → core |
| `GET` | `/v1/meeting-rooms` | proxy → core |
| `ALL` | `/v1/meeting-rooms/*` | proxy → core |
| `GET` | `/v1/event-bookings` | proxy → core |
| `ALL` | `/v1/event-bookings/*` | proxy → core |
| `GET` | `/v1/waitlist` | proxy → core |
| `ALL` | `/v1/waitlist/*` | proxy → core |
| `GET` | `/v1/group-bookings` | proxy → core |
| `ALL` | `/v1/group-bookings/*` | proxy → core |
| `GET` | `/v1/promo-codes` | proxy → core |
| `ALL` | `/v1/promo-codes/*` | proxy → core |
| **Night Audit & Operations (core proxies)** | | |
| `GET` | `/v1/night-audit/status` | proxy → core |
| `GET` | `/v1/night-audit/history` | proxy → core |
| `ALL` | `/v1/night-audit/*` | proxy → core |
| `GET` | `/v1/ota-connections` | proxy → core |
| `ALL` | `/v1/ota-connections/*` | proxy → core |
| `GET` | `/v1/cashier-sessions` | proxy → core |
| `ALL` | `/v1/cashier-sessions/*` | proxy → core |
| `GET` | `/v1/shift-handovers` | proxy → core |
| `ALL` | `/v1/shift-handovers/*` | proxy → core |
| `GET` | `/v1/lost-and-found` | proxy → core |
| `ALL` | `/v1/lost-and-found/*` | proxy → core |
| `GET` | `/v1/banquet-orders` | proxy → core |
| `ALL` | `/v1/banquet-orders/*` | proxy → core |
| `GET` | `/v1/guest-feedback` | proxy → core |
| `ALL` | `/v1/guest-feedback/*` | proxy → core |
| `GET` | `/v1/police-reports` | proxy → core |
| `ALL` | `/v1/police-reports/*` | proxy → core |

---

#### 2. availability-guard-service
**Route file:** [src/routes/locks.ts](Apps/availability-guard-service/src/routes/locks.ts)

| Method | Path |
|--------|------|
| `POST` | `/v1/locks` |
| `DELETE` | `/v1/locks/:lockId` |
| `POST` | `/v1/locks/bulk-release` |
| `POST` | `/v1/locks/:lockId/manual-release` |
| `POST` | `/v1/notifications/manual-release/test` |
| `GET` | `/v1/locks/:lockId/audit` |
| `GET` | `/v1/locks/audit` |

---

#### 3. billing-service
**Route files:** [src/routes/health.ts](Apps/billing-service/src/routes/health.ts), [src/routes/billing.ts](Apps/billing-service/src/routes/billing.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/ready` |
| `GET` | `/v1/billing/payments` |
| `GET` | `/v1/billing/invoices` |
| `GET` | `/v1/billing/invoices/:invoiceId` |
| `GET` | `/v1/billing/folios` |
| `GET` | `/v1/billing/folios/:folioId` |
| `GET` | `/v1/billing/charges` |
| `GET` | `/v1/billing/tax-configurations` |
| `GET` | `/v1/billing/tax-configurations/:taxConfigId` |

---

#### 4. command-center-service
**Route files:** [src/routes/health.ts](Apps/command-center-service/src/routes/health.ts), [src/routes/commands.ts](Apps/command-center-service/src/routes/commands.ts), [src/routes/command-definitions.ts](Apps/command-center-service/src/routes/command-definitions.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/ready` |
| `POST` | `/v1/commands/:commandName/execute` |
| `GET` | `/v1/commands/definitions` |

---

#### 5. core-service
**Route files (17):** [src/routes/](Apps/core-service/src/routes/) — auth.ts, health.ts, tenants.ts, properties.ts, users.ts, reservations.ts, modules.ts, dashboard.ts, booking-config.ts, reports.ts, night-audit.ts, operations.ts, system-auth.ts, system-tenants.ts, system-users.ts, system-impersonation.ts, user-tenant-associations.ts

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/ready` |
| `POST` | `/v1/auth/login` |
| `GET` | `/v1/auth/context` |
| `POST` | `/v1/auth/change-password` |
| `POST` | `/v1/auth/mfa/enroll` |
| `POST` | `/v1/auth/mfa/verify` |
| `POST` | `/v1/auth/mfa/rotate` |
| `GET` | `/v1/tenants` |
| `POST` | `/v1/tenants/bootstrap` |
| `POST` | `/v1/properties` |
| `GET` | `/v1/properties` |
| `GET` | `/v1/users` |
| `POST` | `/v1/users` |
| `POST` | `/v1/users/reset-password` |
| `GET` | `/v1/reservations/:id` |
| `GET` | `/v1/reservations` |
| `GET` | `/v1/modules/catalog` |
| `GET` | `/v1/tenants/:tenantId/modules` |
| `GET` | `/v1/dashboard/stats` |
| `GET` | `/v1/dashboard/activity` |
| `GET` | `/v1/dashboard/tasks` |
| `GET` | `/v1/allotments` |
| `GET` | `/v1/allotments/:allotmentId` |
| `GET` | `/v1/booking-sources` |
| `GET` | `/v1/booking-sources/:sourceId` |
| `GET` | `/v1/market-segments` |
| `GET` | `/v1/market-segments/:segmentId` |
| `GET` | `/v1/channel-mappings` |
| `GET` | `/v1/channel-mappings/:mappingId` |
| `GET` | `/v1/companies` |
| `GET` | `/v1/companies/:companyId` |
| `GET` | `/v1/meeting-rooms` |
| `GET` | `/v1/meeting-rooms/:roomId` |
| `GET` | `/v1/event-bookings` |
| `GET` | `/v1/event-bookings/:eventId` |
| `GET` | `/v1/waitlist` |
| `GET` | `/v1/waitlist/:waitlistId` |
| `GET` | `/v1/group-bookings` |
| `GET` | `/v1/group-bookings/:groupBookingId` |
| `GET` | `/v1/promo-codes` |
| `GET` | `/v1/promo-codes/:promoId` |
| `POST` | `/v1/promo-codes/validate` |
| `GET` | `/v1/reports/performance` |
| `GET` | `/v1/night-audit/status` |
| `GET` | `/v1/night-audit/history` |
| `GET` | `/v1/night-audit/runs/:runId` |
| `GET` | `/v1/ota-connections` |
| `GET` | `/v1/ota-connections/:connectionId/sync-history` |
| `GET` | `/v1/cashier-sessions` |
| `GET` | `/v1/cashier-sessions/:sessionId` |
| `GET` | `/v1/shift-handovers` |
| `GET` | `/v1/shift-handovers/:handoverId` |
| `GET` | `/v1/lost-and-found` |
| `GET` | `/v1/lost-and-found/:itemId` |
| `GET` | `/v1/banquet-orders` |
| `GET` | `/v1/banquet-orders/:beoId` |
| `GET` | `/v1/guest-feedback` |
| `GET` | `/v1/guest-feedback/:feedbackId` |
| `GET` | `/v1/police-reports` |
| `GET` | `/v1/police-reports/:reportId` |
| `POST` | `/v1/system/auth/login` |
| `POST` | `/v1/system/auth/break-glass` |
| `POST` | `/v1/system/tenants/bootstrap` |
| `POST` | `/v1/system/tenants` |
| `GET` | `/v1/system/tenants` |
| `POST` | `/v1/system/users` |
| `GET` | `/v1/system/users` |
| `POST` | `/v1/system/impersonate` |
| `GET` | `/v1/user-tenant-associations` |
| `POST` | `/v1/user-tenant-associations/role` |
| `POST` | `/v1/user-tenant-associations/status` |

---

#### 6. guests-service
**Route files:** [src/routes/health.ts](Apps/guests-service/src/routes/health.ts), [src/routes/guests.ts](Apps/guests-service/src/routes/guests.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/ready` |
| `GET` | `/v1/guests` |
| `GET` | `/v1/guests/:guestId` |
| `GET` | `/v1/guests/:guestId/preferences` |
| `GET` | `/v1/guests/:guestId/documents` |
| `GET` | `/v1/guests/:guestId/communications` |

---

#### 7. housekeeping-service
**Route files:** [src/routes/health.ts](Apps/housekeeping-service/src/routes/health.ts), [src/routes/housekeeping.ts](Apps/housekeeping-service/src/routes/housekeeping.ts), [src/routes/incidents.ts](Apps/housekeeping-service/src/routes/incidents.ts), [src/routes/maintenance.ts](Apps/housekeeping-service/src/routes/maintenance.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/ready` |
| `GET` | `/v1/housekeeping/tasks` |
| `GET` | `/v1/incidents` |
| `GET` | `/v1/incidents/:incidentId` |
| `GET` | `/v1/maintenance/requests` |
| `GET` | `/v1/maintenance/requests/:requestId` |

---

#### 8. notification-service
**Route files:** [src/routes/health.ts](Apps/notification-service/src/routes/health.ts), [src/routes/notifications.ts](Apps/notification-service/src/routes/notifications.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/ready` |
| `GET` | `/v1/tenants/:tenantId/notifications/templates` |
| `GET` | `/v1/tenants/:tenantId/notifications/templates/:templateId` |
| `GET` | `/v1/tenants/:tenantId/notifications/guests/:guestId/communications` |
| `GET` | `/v1/tenants/:tenantId/notifications/communications/:communicationId` |

---

#### 9. recommendation-service
**Route files:** [src/routes/health.ts](Apps/recommendation-service/src/routes/health.ts), [src/routes/recommendations.ts](Apps/recommendation-service/src/routes/recommendations.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/health/readiness` |
| `GET` | `/v1/recommendations` |
| `POST` | `/v1/recommendations/rank` |

---

#### 10. reservations-command-service
**Route file:** [src/server.ts](Apps/reservations-command-service/src/server.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/ready` |
| `GET` | `/health/liveness` |
| `GET` | `/health/readiness` |
| `GET` | `/health/reliability` |
| `GET` | `/metrics` |
| `GET` | `/v1/reservations/:reservationId/lifecycle` |

---

#### 11. roll-service
**Route file:** [src/server.ts](Apps/roll-service/src/server.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/health/readiness` |
| `GET` | `/metrics` |

---

#### 12. rooms-service
**Route files:** [src/routes/health.ts](Apps/rooms-service/src/routes/health.ts), [src/routes/rooms.ts](Apps/rooms-service/src/routes/rooms.ts), [src/routes/room-types.ts](Apps/rooms-service/src/routes/room-types.ts), [src/routes/rates.ts](Apps/rooms-service/src/routes/rates.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/ready` |
| `POST` | `/v1/rooms` |
| `GET` | `/v1/rooms` |
| `GET` | `/v1/rooms/:roomId` |
| `PUT` | `/v1/rooms/:roomId` |
| `DELETE` | `/v1/rooms/:roomId` |
| `GET` | `/v1/rooms/availability` |
| `GET` | `/v1/room-types` |
| `POST` | `/v1/room-types` |
| `PUT` | `/v1/room-types/:roomTypeId` |
| `DELETE` | `/v1/room-types/:roomTypeId` |
| `GET` | `/v1/rates` |
| `GET` | `/v1/rates/:rateId` |
| `POST` | `/v1/rates` |
| `PUT` | `/v1/rates/:rateId` |
| `DELETE` | `/v1/rates/:rateId` |

---

#### 13. settings-service
**Route files:** [src/routes/amenities.ts](Apps/settings-service/src/routes/amenities.ts), [src/routes/catalog.ts](Apps/settings-service/src/routes/catalog.ts), [src/routes/packages.ts](Apps/settings-service/src/routes/packages.ts) + health in [src/app.ts](Apps/settings-service/src/app.ts)

| Method | Path |
|--------|------|
| `GET` | `/health` |
| `GET` | `/ready` |
| `GET` | `/v1/settings/properties/:propertyId/amenities` |
| `POST` | `/v1/settings/properties/:propertyId/amenities` |
| `PUT` | `/v1/settings/properties/:propertyId/amenities/:amenityCode` |
| `GET` | `/v1/settings/catalog` |
| `GET` | `/v1/settings/catalog/:categoryCode` |
| `GET` | `/v1/settings/categories` |
| `GET` | `/v1/settings/sections` |
| `GET` | `/v1/settings/definitions` |
| `GET` | `/v1/settings/options` |
| `GET` | `/v1/settings/values` |
| `POST` | `/v1/settings/values` |
| `PATCH` | `/v1/settings/values/:valueId` |
| `GET` | `/v1/packages` |
| `GET` | `/v1/packages/:packageId` |
| `GET` | `/v1/packages/:packageId/components` |

---

### Summary

| Category | Count |
|----------|-------|
| **Library packages** (no HTTP) | 9 |
| **Services with HTTP endpoints** | 13 |
| **Total Apps** | 22 |
| **Unique backend endpoints** (excl. gateway proxies) | ~135 |
| **Gateway proxy/command routes** | ~120 |
