# HTTP Test Coverage Report

> Auto-generated gap analysis comparing API Gateway route registrations against `http_test/*.http` files.

## Executive Summary

| Metric | Count |
|--------|-------|
| Gateway route files analyzed | 12 |
| http_test files analyzed | 21 (excluding `_environment.http`) |
| Registered route groups | ~120+ distinct endpoint patterns |
| **Fully covered** | ~115+ |
| **MISSING from http_test** | **6 endpoints** |
| **Gateway routing gap** | `/v1/locks/*` (availability-guard not proxied) |

**Overall coverage: ~95%** — excellent. Only two small gaps remain.

---

## Gap 1: Metasearch Config Endpoints (MISSING)

**Source:** [booking-config-routes.ts](../Apps/api-gateway/src/routes/booking-config-routes.ts)
**Target file:** [booking-config.http](booking-config.http)

These 3 route patterns are registered in the gateway but have zero test coverage:

| Method | Gateway Route | Status |
|--------|--------------|--------|
| `GET` | `/v1/metasearch-configs` | **MISSING** |
| `GET` | `/v1/metasearch-configs/performance` | **MISSING** |
| `ALL` | `/v1/metasearch-configs/*` | **MISSING** |

### Suggested additions for `booking-config.http`:

```http
### -----------------------------------------------
### METASEARCH CONFIGURATIONS (Google Hotel Ads, TripAdvisor, etc.)
### -----------------------------------------------

### List All Metasearch Configurations
GET {{baseUrl}}/v1/metasearch-configs?tenant_id={{tenantId}}&limit=100
Authorization: Bearer {{accessToken}}
Content-Type: application/json

### List Active Metasearch Configurations
GET {{baseUrl}}/v1/metasearch-configs?tenant_id={{tenantId}}&is_active=true
Authorization: Bearer {{accessToken}}
Content-Type: application/json

### Metasearch Performance Summary
GET {{baseUrl}}/v1/metasearch-configs/performance?tenant_id={{tenantId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json

### Metasearch Performance for Property
GET {{baseUrl}}/v1/metasearch-configs/performance?tenant_id={{tenantId}}&property_id={{propertyId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json

### Get Metasearch Config by ID
GET {{baseUrl}}/v1/metasearch-configs/{{metasearchConfigId}}?tenant_id={{tenantId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

---

## Gap 2: Loyalty READ Endpoints (MISSING)

**Source:** [guest-routes.ts](../Apps/api-gateway/src/routes/guest-routes.ts)
**Target file:** [guests.http](guests.http)

These 3 read endpoints are registered in the gateway but have zero test coverage:

| Method | Gateway Route | Status |
|--------|--------------|--------|
| `GET` | `/v1/loyalty/transactions` | **MISSING** |
| `GET` | `/v1/loyalty/tier-rules` | **MISSING** |
| `GET` | `/v1/loyalty/programs/:programId/balance` | **MISSING** |

> **Note:** Loyalty _commands_ (`loyalty.points.earn`, `loyalty.points.redeem`, `guest.set_loyalty`) ARE covered in `command-center.http`. Only the read endpoints are missing.

### Suggested additions for `guests.http`:

```http
###############################################################################
# 7. LOYALTY - READ ENDPOINTS
###############################################################################

### List loyalty transactions for tenant
GET {{baseUrl}}/v1/loyalty/transactions?tenant_id={{tenantId}}&limit=50
Authorization: Bearer {{authToken}}

###
### List loyalty transactions for a specific guest
GET {{baseUrl}}/v1/loyalty/transactions?tenant_id={{tenantId}}&guest_id={{guestId}}&limit=50
Authorization: Bearer {{authToken}}

###
### List loyalty tier rules
GET {{baseUrl}}/v1/loyalty/tier-rules?tenant_id={{tenantId}}
Authorization: Bearer {{authToken}}

###
### Get loyalty program balance for a guest
@programId = aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
GET {{baseUrl}}/v1/loyalty/programs/{{programId}}/balance?tenant_id={{tenantId}}&guest_id={{guestId}}
Authorization: Bearer {{authToken}}
```

---

## Issue: Availability Guard Gateway Routing Gap

**File:** [availability-guard.http](availability-guard.http)

The `availability-guard.http` file tests `/v1/locks/*` endpoints against the API Gateway (`localhost:8080`), but **no `/v1/locks` routes are registered in any gateway route file**. The availability-guard-service (port 3045) is primarily a gRPC service for sub-ms inventory locks from the reservations pipeline.

**Endpoints tested in `availability-guard.http` but NOT proxied by API gateway:**

| Method | Path | Note |
|--------|------|------|
| `POST` | `/v1/locks` | Create lock |
| `DELETE` | `/v1/locks/:lockId` | Release lock |
| `POST` | `/v1/locks/bulk-release` | Bulk release |
| `POST` | `/v1/locks/:lockId/manual-release` | Manual release with audit |
| `GET` | `/v1/locks/:lockId/audit` | Lock audit history |
| `GET` | `/v1/locks/audit` | Tenant-wide audit search |
| `POST` | `/v1/notifications/manual-release/test` | Notification dry-run |

**Action needed:** Either add these routes to the API gateway (create `availability-guard-routes.ts`), or update `availability-guard.http` to target the service directly at `localhost:3045`.

---

## Full Coverage Matrix

### Health — [health.http](health.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `OPTIONS` | `/health` | ✅ |
| `GET` | `/health` | ✅ |
| `GET` | `/ready` | ✅ |
| `GET` | `/health/all` | ✅ |

### Core — Auth, Users, System — [core-service.http](core-service.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `POST` | `/v1/auth/login` | ✅ |
| `GET` | `/v1/auth/context` | ✅ |
| `POST` | `/v1/auth/change-password` | ✅ |
| `POST` | `/v1/auth/mfa/enroll` | ✅ |
| `POST` | `/v1/auth/mfa/verify` | ✅ |
| `POST` | `/v1/auth/mfa/rotate` | ✅ |
| `GET` | `/v1/users` | ✅ |
| `POST` | `/v1/users` | ✅ |
| `POST` | `/v1/users/reset-password` | ✅ |
| `GET` | `/v1/user-tenant-associations` | ✅ |
| `POST` | `/v1/user-tenant-associations/role` | ✅ |
| `POST` | `/v1/user-tenant-associations/status` | ✅ |
| `POST` | `/v1/system/auth/login` | ✅ |
| `POST` | `/v1/system/auth/break-glass` | ✅ |
| `GET` | `/v1/system/tenants` | ✅ |
| `POST` | `/v1/system/tenants` | ✅ |
| `POST` | `/v1/system/tenants/bootstrap` | ✅ |
| `GET` | `/v1/system/users` | ✅ |
| `POST` | `/v1/system/users` | ✅ |
| `POST` | `/v1/system/impersonate` | ✅ |

### Tenants & Properties — [tenantandproperty.http](tenantandproperty.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/tenants` | ✅ |
| `POST` | `/v1/tenants/bootstrap` | ✅ |
| `GET` | `/v1/properties` | ✅ |
| `POST` | `/v1/properties` | ✅ |
| `GET` | `/v1/dashboard/stats` | ✅ |
| `GET` | `/v1/dashboard/activity` | ✅ |
| `GET` | `/v1/dashboard/tasks` | ✅ |
| `GET` | `/v1/reports/performance` | ✅ |

### Modules — [modules.http](modules.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/modules/catalog` | ✅ |
| `GET` | `/v1/tenants/:tenantId/modules` | ✅ |

### Rooms & Room Types — [rooms.http](rooms.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/rooms` | ✅ |
| `POST` | `/v1/rooms` | ✅ |
| `GET` | `/v1/rooms/:id` | ✅ |
| `PUT` | `/v1/rooms/:id` | ✅ |
| `DELETE` | `/v1/rooms/:id` | ✅ |
| `GET` | `/v1/rooms/availability` | ✅ |
| `GET` | `/v1/room-types` | ✅ |
| `POST` | `/v1/room-types` | ✅ |
| `GET` | `/v1/room-types/:id` | ✅ |
| `PUT` | `/v1/room-types/:id` | ✅ |
| `PATCH` | `/v1/room-types/:id` | ✅ |
| `DELETE` | `/v1/room-types/:id` | ✅ |
| `POST` | `/v1/tenants/:tid/rooms/:rid/block` | ✅ |
| `POST` | `/v1/tenants/:tid/rooms/:rid/release` | ✅ |
| `POST` | `/v1/tenants/:tid/rooms/:rid/status` | ✅ |
| `POST` | `/v1/tenants/:tid/rooms/:rid/housekeeping-status` | ✅ |
| `POST` | `/v1/tenants/:tid/rooms/:rid/out-of-order` | ✅ |
| `POST` | `/v1/tenants/:tid/rooms/:rid/out-of-service` | ✅ |
| `POST` | `/v1/tenants/:tid/rooms/:rid/features` | ✅ |

### Rates — [rates.http](rates.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/rates` | ✅ |
| `POST` | `/v1/rates` | ✅ |
| `GET` | `/v1/rates/:id` | ✅ |
| `PUT` | `/v1/rates/:id` | ✅ |
| `DELETE` | `/v1/rates/:id` | ✅ |

### Reservations — [reservations.http](reservations.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/reservations` | ✅ |
| `GET` | `/v1/reservations/:id` | ✅ |
| `GET` | `/v1/reservations/:id/lifecycle` | ✅ |
| `GET` | `/v1/reservations/:id/check-in-brief` | ✅ |
| `GET` | `/v1/tenants/:tid/reservations` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/cancel` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/check-in` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/check-out` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/assign-room` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/unassign-room` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/extend` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/rate-override` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/deposit/add` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/deposit/release` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/:rid/no-show` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/walk-in` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/waitlist` | ✅ |
| `POST` | `/v1/tenants/:tid/reservations/waitlist/:wid/convert` | ✅ |

### Guests — [guests.http](guests.http) ⚠️ 3 MISSING

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/guests` | ✅ |
| `POST` | `/v1/guests` | ✅ |
| `POST` | `/v1/guests/merge` | ✅ |
| `GET` | `/v1/guests/:gid/preferences` | ✅ |
| `GET` | `/v1/guests/:gid/documents` | ✅ |
| `GET` | `/v1/guests/:gid/communications` | ✅ |
| `POST` | `/v1/tenants/:tid/guests/:gid/profile` | ✅ |
| `POST` | `/v1/tenants/:tid/guests/:gid/contact` | ✅ |
| `POST` | `/v1/tenants/:tid/guests/:gid/loyalty` | ✅ |
| `POST` | `/v1/tenants/:tid/guests/:gid/vip` | ✅ |
| `POST` | `/v1/tenants/:tid/guests/:gid/blacklist` | ✅ |
| `POST` | `/v1/tenants/:tid/guests/:gid/gdpr-erase` | ✅ |
| `POST` | `/v1/tenants/:tid/guests/:gid/preferences` | ✅ |
| `GET` | `/v1/loyalty/transactions` | **❌ MISSING** |
| `GET` | `/v1/loyalty/tier-rules` | **❌ MISSING** |
| `GET` | `/v1/loyalty/programs/:pid/balance` | **❌ MISSING** |

### Billing — [billing.http](billing.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/billing/payments` | ✅ |
| `GET` | `/v1/billing/invoices` | ✅ |
| `GET` | `/v1/billing/folios` | ✅ |
| `GET` | `/v1/billing/charges` | ✅ |
| `GET` | `/v1/billing/tax-configurations` | ✅ |
| `GET` | `/v1/billing/cashier-sessions` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/payments/capture` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/payments/:pid/refund` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/payments/:pid/apply` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/payments/:pid/void` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/invoices` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/invoices/:iid/adjust` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/charges` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/folios/transfer` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/folios/close` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/cashier-sessions/open` | ✅ |
| `POST` | `/v1/tenants/:tid/billing/cashier-sessions/close` | ✅ |

### Housekeeping — [housekeeping.http](housekeeping.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/housekeeping/tasks` | ✅ |
| `GET` | `/v1/housekeeping/deep-clean-due` | ✅ |
| `GET` | `/v1/housekeeping/schedules` | ✅ |
| `GET` | `/v1/housekeeping/inspections` | ✅ |
| `POST` | `/v1/tenants/:tid/housekeeping/tasks` | ✅ |
| `POST` | `/v1/tenants/:tid/housekeeping/tasks/:id/assign` | ✅ |
| `POST` | `/v1/tenants/:tid/housekeeping/tasks/:id/complete` | ✅ |
| `POST` | `/v1/tenants/:tid/housekeeping/tasks/:id/reassign` | ✅ |
| `POST` | `/v1/tenants/:tid/housekeeping/tasks/:id/reopen` | ✅ |
| `POST` | `/v1/tenants/:tid/housekeeping/tasks/:id/notes` | ✅ |
| `POST` | `/v1/tenants/:tid/housekeeping/tasks/bulk-status` | ✅ |

### Operations — [operations.http](operations.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/maintenance/requests` | ✅ |
| `GET` | `/v1/incidents` | ✅ |
| `GET` | `/v1/cashier-sessions` | ✅ |
| `GET` | `/v1/shift-handovers` | ✅ |
| `GET` | `/v1/lost-and-found` | ✅ |
| `GET` | `/v1/banquet-orders` | ✅ |
| `GET` | `/v1/guest-feedback` | ✅ |
| `GET` | `/v1/police-reports` | ✅ |
| `GET/POST` | `/v1/compliance/breach-incidents` | ✅ |

### Booking Config — [booking-config.http](booking-config.http) ⚠️ 3 MISSING

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/allotments` | ✅ |
| `GET` | `/v1/booking-sources` | ✅ |
| `GET` | `/v1/market-segments` | ✅ |
| `GET` | `/v1/channel-mappings` | ✅ |
| `GET` | `/v1/companies` | ✅ |
| `GET` | `/v1/meeting-rooms` | ✅ |
| `GET` | `/v1/event-bookings` | ✅ |
| `GET` | `/v1/waitlist` | ✅ |
| `GET` | `/v1/metasearch-configs` | **❌ MISSING** |
| `GET` | `/v1/metasearch-configs/performance` | **❌ MISSING** |
| `ALL` | `/v1/metasearch-configs/*` | **❌ MISSING** |

### Night Audit & Extras — [night-audit.http](night-audit.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/night-audit/status` | ✅ |
| `GET` | `/v1/night-audit/history` | ✅ |
| `GET` | `/v1/night-audit/runs/:id` | ✅ |
| `GET` | `/v1/ota-connections` | ✅ |
| `GET` | `/v1/group-bookings` | ✅ |
| `GET` | `/v1/promo-codes` | ✅ |
| `POST` | `/v1/promo-codes/validate` | ✅ |

### Revenue — [revenue.http](revenue.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/revenue/pricing-rules` | ✅ |
| `GET` | `/v1/revenue/rate-recommendations` | ✅ |
| `GET` | `/v1/revenue/competitor-rates` | ✅ |
| `GET` | `/v1/revenue/demand-calendar` | ✅ |
| `GET` | `/v1/revenue/forecasts` | ✅ |
| `GET` | `/v1/revenue/goals` | ✅ |
| `GET` | `/v1/revenue/kpis` | ✅ |
| `GET` | `/v1/revenue/compset-indices` | ✅ |

### Recommendations — [recommendations.http](recommendations.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/recommendations` | ✅ |
| `POST` | `/v1/recommendations/rank` | ✅ |

### Notifications — [notifications.http](notifications.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/tenants/:tid/notifications/templates` | ✅ |
| `GET` | `/v1/tenants/:tid/notifications/templates/:id` | ✅ |
| `POST` | `/v1/tenants/:tid/notifications/templates` | ✅ |
| `PUT` | `/v1/tenants/:tid/notifications/templates/:id` | ✅ |
| `DELETE` | `/v1/tenants/:tid/notifications/templates/:id` | ✅ |
| `POST` | `/v1/tenants/:tid/notifications/send` | ✅ |
| `GET` | `/v1/tenants/:tid/notifications/guests/:gid/communications` | ✅ |
| `GET` | `/v1/tenants/:tid/notifications/communications/:cid` | ✅ |
| `GET` | `/v1/tenants/:tid/notifications/automated-messages` | ✅ |
| `GET` | `/v1/tenants/:tid/notifications/automated-messages/:mid` | ✅ |
| `POST` | `/v1/tenants/:tid/notifications/automated-messages` | ✅ |
| `PUT` | `/v1/tenants/:tid/notifications/automated-messages/:mid` | ✅ |
| `DELETE` | `/v1/tenants/:tid/notifications/automated-messages/:mid` | ✅ |

### Self-Service — [self-service.http](self-service.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/self-service/search` | ✅ |
| `POST` | `/v1/self-service/book` | ✅ |
| `GET` | `/v1/self-service/booking/:code` | ✅ |
| `POST` | `/v1/self-service/check-in/start` | ✅ |
| `POST` | `/v1/self-service/check-in/:id/complete` | ✅ |
| `GET` | `/v1/self-service/check-in/:id` | ✅ |
| `GET` | `/v1/self-service/registration-card/:rid` | ✅ |
| `GET` | `/v1/self-service/registration-card/:rid/html` | ✅ |
| `GET` | `/v1/self-service/keys/:rid` | ✅ |

### Settings & Packages — [settings-service.http](settings-service.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/settings/ping` | ✅ |
| `GET` | `/v1/settings/catalog` | ✅ |
| `GET` | `/v1/settings/categories` | ✅ |
| `GET` | `/v1/settings/sections` | ✅ |
| `GET` | `/v1/settings/definitions` | ✅ |
| `GET` | `/v1/settings/options` | ✅ |
| `GET` | `/v1/settings/values` | ✅ |
| `POST` | `/v1/settings/values` | ✅ |
| `PATCH` | `/v1/settings/values/:id` | ✅ |
| `GET` | `/v1/settings/properties/:pid/amenities` | ✅ |
| `POST` | `/v1/settings/properties/:pid/amenities` | ✅ |
| `PUT` | `/v1/settings/properties/:pid/amenities/:code` | ✅ |
| `GET` | `/v1/packages` | ✅ |
| `GET` | `/v1/packages/:id` | ✅ |
| `GET` | `/v1/packages/:id/components` | ✅ |

### Reports — [reports.http](reports.http) ✅ COMPLETE

| Method | Route | Covered |
|--------|-------|---------|
| `GET` | `/v1/reports/occupancy` | ✅ |
| `GET` | `/v1/reports/revenue-kpis` | ✅ |
| `GET` | `/v1/reports/arrivals` | ✅ |
| `GET` | `/v1/reports/departures` | ✅ |
| `GET` | `/v1/reports/in-house` | ✅ |
| `GET` | `/v1/reports/demand-forecast` | ✅ |
| `GET` | `/v1/reports/pace` | ✅ |
| `GET` | `/v1/reports/revenue-forecast` | ✅ |

### Command Center — [command-center.http](command-center.http) ✅ COMPLETE

79 commands tested including all reservation, guest, room, housekeeping, billing, settings, integration, analytics, operations, notification, and loyalty commands.

---

## Action Items

| Priority | Action | File |
|----------|--------|------|
| **P1** | Add metasearch-configs GET endpoints | [booking-config.http](booking-config.http) |
| **P1** | Add loyalty read endpoints (transactions, tier-rules, balance) | [guests.http](guests.http) |
| **P2** | Decide: proxy `/v1/locks/*` through gateway OR update [availability-guard.http](availability-guard.http) to target `localhost:3045` directly | Gateway + availability-guard.http |
