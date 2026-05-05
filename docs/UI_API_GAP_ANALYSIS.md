# UI ↔ API Gap Analysis — `pms-ui` vs gateway endpoints exercised by `test-multi-tenant.sh`

> Generated: 2026-05-05
> Sources cross-referenced:
> - [executables/test-accounts-realdata/test-multi-tenant.sh](../executables/test-accounts-realdata/test-multi-tenant.sh) — full multi-tenant E2E billing test (~230 assertions, 7 phases)
> - [Apps/api-gateway/src/routes](../Apps/api-gateway/src/routes) — 20 route files, ~220 registered endpoints
> - [UI/pms-ui/src/app/features](../UI/pms-ui/src/app/features) + [layout/nav-config.ts](../UI/pms-ui/src/app/layout/nav-config.ts)

No code changes were made — report only.

---

## 1. Method

| Source | What was extracted |
|---|---|
| `test-multi-tenant.sh` | All `/v1/...` endpoints called and all `commands/<name>/execute` dispatched. |
| `Apps/api-gateway/src/routes/*.ts` | All registered gateway routes. |
| `UI/pms-ui/src/app/features/**` | All Angular features, the API URLs they call, and the navigation items the user can reach. |

---

## 2. What the UI already covers (parity with the test)

| Test command / endpoint | UI screen | Status |
|---|---|---|
| `reservation.create` / `.modify` / `.check-in` / `.check-out` / `.cancel` | `features/reservations/` + `reservation-detail` | ✅ |
| `billing.charge.post` / `.void` | `reservation-detail.ts` + `billing.html` | ✅ |
| `billing.payment.capture` / `.refund` / `.void` | `billing-payments.service.ts` | ✅ |
| `billing.invoice.create` / `.finalize` / `.void` / `.reopen` / credit-note / adjust | `accounts/invoices/invoices.ts` + `billing-invoices.service.ts` | ✅ |
| `billing.folio.create` / `.merge` / `.reopen` / split / windows / tax-exemption | `billing-folios.service.ts` | ✅ |
| `billing.comp.post` | `billing-folios.service.ts` | ✅ |
| `billing.cashier.open` / `.close` / handover | `accounts/cashiering/cashiering.ts` | ✅ |
| `billing.night_audit.execute` / `date_roll.manual` / pre-audit / bucket-check / trial-balance / dept-revenue / tax-summary | `accounts/night-audit/night-audit.ts` | ✅ |
| `billing.ledger.post` (+ ledger list) | `accounts/ledger/ledger.ts` | ✅ |
| `billing.ar.apply_payment` / `.write_off` / `.age` (+ aging summary) | `accounts/accounts-receivable/accounts-receivable.ts` | ✅ |
| `billing.fiscal_period.close` / `.lock` / `.reopen` | `accounts/fiscal-periods/fiscal-periods.ts` | ✅ |
| `billing.tax_config.create` / update / delete | `accounts/tax-config/tax-config.ts` | ✅ |
| `billing.routing_rule.*` (create/update/delete/clone) | `billing-routing.service.ts` | ✅ |
| `billing.express_checkout` | `reservation-detail.ts` | ✅ |
| `billing.no_show.charge` | `reservation-detail.ts` | ✅ |
| `group.create` / `group.check_in` | `features/groups/` | ✅ |
| Commission report | `accounts/commissions/commissions.ts` | ✅ |
| Command feature flags batch | `features/command-management/` | ✅ |

---

## 3. Gaps — exercised by the API/test but NOT in the UI

### 3.1 Critical gaps (test directly exercises, UI absent)

| # | Capability | Endpoint / command | Why it matters | Suggested UI home |
|---|---|---|---|---|
| **G1** | **GL batch export** | `billing.gl_batch.export` + `GET /v1/billing/gl-batches` + `GET /v1/billing/gl-batches/:id/entries` | Marks GL batches POSTED for ERP export. No screen at all — ledger page only posts entries, never lists batches. | New tab in `accounts/ledger` or new "GL Batches" page. |
| **G2** | **Charge transfer between folios** | `billing.charge.transfer` + `POST /v1/tenants/:tid/billing/folios/transfer` | Test moves MINIBAR → HOUSE_ACCOUNT folio. UI folio actions support merge/split/windows but no per-charge transfer. | Action on charge row in `billing.html`. |
| **G3** | **Chargeback status** | `billing.chargeback.update_status` + `POST /v1/tenants/:tid/billing/chargebacks/:refundId/status` | Disputed-payment lifecycle. No chargebacks screen, no action on refunded payments. | New tab in billing or refund-row action. |
| **G4** | **Late-checkout charge** | `billing.late_checkout.charge` + `POST /v1/tenants/:tid/billing/reservations/:id/late-checkout-charge` | Gateway route exists; UI only wires the no-show variant. | New action in `reservation-detail.ts`. |
| **G5** | **Cancellation penalty** | `billing.cancellation.penalty` + `POST /v1/tenants/:tid/billing/reservations/:id/cancellation-penalty` | Manual penalty posting. UI cancel flow does not collect penalty amount. | Wire into cancel dialog. |
| **G6** | **Reports module** | `/v1/reports/arrivals,departures,forecast,housekeeping-status,in-house,manager-flash,night-audit-summary,no-show,occupancy,revenue-summary,str-metrics,daily-revenue` | Nav links to `/reports` but **no `features/reports/` folder exists** — clicking the link 404s. | New `features/reports/` module with one tab per report. |

### 3.2 Reservation lifecycle actions exposed by gateway, not in UI

`reservation-detail.ts` only handles check-in, check-out, cancel, modify, no-show-charge and express checkout. Missing:

- `…/reservations/:id/assign-room` / `…/unassign-room`
- `…/reservations/:id/extend`
- `…/reservations/:id/rate-override`
- `…/reservations/:id/deposit/add` and `…/deposit/release`
- `…/reservations/:id/no-show` (status flip; distinct from `no-show-charge`)
- `…/reservations/walk-in`
- `…/reservations/waitlist` + `…/reservations/waitlist/:id/convert`

### 3.3 Room operations exposed by gateway, partially in UI

UI rooms page handles activate/deactivate/status/out-of-order. Missing:

- `…/rooms/:id/out-of-service`
- `…/rooms/:id/block` / `…/release`
- `…/rooms/:id/features` (room-feature edit)
- `…/rooms/:id/housekeeping-status` (direct status push)

### 3.4 Guest module — only basic CRUD

`features/guests/` covers create/edit/profile. Gateway exposes (not wired):

- `…/guests/:id/blacklist`, `…/vip`, `…/loyalty`, `…/preferences`, `…/contact`
- `…/guests/:id/consent` (GET + POST), `…/gdpr-export`, `…/gdpr-erase`, `…/gdpr-rectify`, `…/gdpr-restrict`
- `POST /v1/guests/merge`

### 3.5 Housekeeping — list-only

`housekeeping.ts` reads `/housekeeping/tasks` but does not call:

- `…/housekeeping/tasks` (create), `…/tasks/:id/assign`, `…/reassign`, `…/complete`, `…/notes`, `…/reopen`, `…/bulk-status`

### 3.6 Notifications & webhooks — entirely missing

Nav has a "Notifications" settings link but no feature module for:

- `GET/POST/PUT/DELETE /v1/tenants/:tid/notifications/templates`
- `…/notifications/automated-messages` (CRUD)
- `…/notifications/send`, `…/communications`, per-guest communication history
- Webhooks CRUD + `test`, `replay`, `rotate-secret`, `deliveries`

### 3.7 Loyalty — endpoints exist, no UI

- `GET /v1/loyalty/programs/:id/balance`, `/v1/loyalty/tier-rules`, `/v1/loyalty/transactions`

### 3.8 Module management (per-tenant feature flags)

Test calls `PUT /v1/tenants/:tid/modules` and `GET /v1/modules/catalog` to enable `finance-automation`, `crm-loyalty`, etc. UI has **no admin screen** to toggle modules per tenant.

### 3.9 Long tail of GET endpoints with no UI surface

Read-only endpoints surfaced by the gateway with no UI consumer:

`/v1/allotments`, `/v1/banquet-orders`, `/v1/booking-sources`, `/v1/cashier-sessions` (top-level list), `/v1/channel-mappings`, `/v1/companies`, `/v1/event-bookings`, `/v1/guest-feedback`, `/v1/lost-and-found`, `/v1/market-segments`, `/v1/meeting-rooms`, `/v1/metasearch-configs` (+ `/performance`), `/v1/ota-connections`, `/v1/police-reports`, `/v1/promo-codes`, `/v1/revenue/pricing-rules`, `/v1/shift-handovers`, `/v1/waitlist`.

### 3.10 Self-service guest portal

`/v1/self-service/*` (booking, check-in, keys, registration-card, search) — no consumer in `pms-ui`. Likely intentional (separate guest-facing app); confirm with product.

### 3.11 Property/tenant onboarding gaps

| Test action | UI |
|---|---|
| `POST /v1/tenants` (create new tenant) | ❌ no admin tenant-onboarding screen |
| `POST /v1/properties` | ✅ `select-property/create-property-dialog` |
| `POST /v1/room-types` / `/v1/rooms` | ✅ rooms feature |
| `POST /v1/rates` (calendar seed) | ✅ rates + rate-calendar |
| `POST /v1/users` + `/v1/user-tenant-associations` | ✅ users feature (verify membership/role flows) |

---

## 4. Implementation plan

Each phase ends with a `pnpm run build` gate (per `AGENTS.md` Task Completion Gate).

### Phase A — Plug critical billing/accounting holes
1. **GL Batches viewer + export action** (G1) — new sub-tab inside `accounts/ledger`; list `/v1/billing/gl-batches`, drill into entries via `/:id/entries`, "Mark Posted" button → `billing.gl_batch.export`.
2. **Charge transfer dialog** (G2) — context action on each charge row in `billing.html`; POST `…/folios/transfer`.
3. **Late-checkout & cancellation-penalty** (G4, G5) — wire into `reservation-detail.ts` actions panel.
4. **Chargeback status** (G3) — "Disputes" tab in billing showing refunds with `dispute_status`; status update modal.

### Phase B — Reports module scaffold
1. Create `UI/pms-ui/src/app/features/reports/` with sub-routes per report (arrivals, departures, in-house, no-show, occupancy, revenue-summary, daily-revenue, manager-flash, forecast, str-metrics, night-audit-summary, housekeeping-status).
2. Each tab: filter (date range / property) → `GET /v1/reports/<name>` → table + CSV export.
3. Replace dead `/reports` nav link with the new module.

### Phase C — Reservation lifecycle completeness
- Add: walk-in dialog, waitlist tab + convert, extend-stay, rate-override, room assign/unassign, deposit add/release.
- All map to existing `…/reservations/*` POST routes.

### Phase D — Room operations
- Out-of-service, block/release, edit features, push housekeeping status — extend `room-detail.ts`.

### Phase E — Guest CRM expansion
- VIP / blacklist / loyalty enrollment / contact / preferences tabs in `guest-detail.ts`.
- GDPR actions panel (export, erase, rectify, restrict, consent log).
- Guest merge wizard.

### Phase F — Housekeeping action surface
- Assign / reassign / complete / reopen / notes / bulk-status actions on the existing `housekeeping.html` task table.

### Phase G — Communications & webhooks
1. New `features/notifications/` module: templates CRUD, automated-message rules CRUD, send-ad-hoc, per-guest communication history.
2. New `features/webhooks/` module under Settings: CRUD + Test / Replay / Rotate-secret / Deliveries log.

### Phase H — Module/tenant administration
- Admin-scoped screen behind `/settings/ADVANCED_TRENDING` (or new "Modules" tab) listing `/v1/modules/catalog` and toggling `PUT /v1/tenants/:tid/modules`.
- Tenant onboarding wizard (`POST /v1/tenants`) for system admins.

### Phase I — Long-tail catalogs
Standalone list+CRUD screens for: allotments, companies, market-segments, booking-sources, promo-codes, ota-connections, channel-mappings, metasearch-configs, banquet-orders, event-bookings, meeting-rooms, lost-and-found, police-reports, guest-feedback, shift-handovers, pricing-rules, waitlist, top-level cashier-sessions list.

### Phase J — Loyalty
Loyalty programs balance + transactions + tier-rules screen (likely lives under Guests).

### Phase K — Decision: self-service
Confirm with product whether `/v1/self-service/*` belongs in `pms-ui` or in a separate guest portal app. If in `pms-ui`, build a minimal self-service preview/test harness; otherwise leave out.

---

## 5. Summary numbers

- Gateway exposes **~220 endpoints** across **20 route files**.
- UI consumes **~80 endpoints** (~37 % surface coverage).
- Test exercises **~40 commands + ~30 read endpoints**; UI is missing **6 of those flows directly** (Phase A items + Reports).
- Largest unexposed surfaces: **Reports**, **Notifications/Webhooks**, **Long-tail catalogs**, **Guest CRM (loyalty/GDPR/blacklist)**.

---

## 6. Quick-reference: command coverage matrix

| Command (from `command_templates`) | Test ✓ | UI ✓ |
|---|:-:|:-:|
| `reservation.create` / `.modify` | ✓ | ✓ |
| `billing.charge.post` / `.void` | ✓ | ✓ |
| `billing.charge.transfer` | ✓ | ✗ |
| `billing.payment.capture` / `.refund` | ✓ | ✓ |
| `billing.invoice.create` / `.finalize` / `.reopen` | ✓ | ✓ |
| `billing.folio.create` / `.merge` / `.reopen` | ✓ | ✓ |
| `billing.cashier.open` / `.close` | ✓ | ✓ |
| `billing.ar.post` / `.apply_payment` / `.write_off` / `.age` | ✓ | ✓ |
| `billing.night_audit.execute` | ✓ | ✓ |
| `billing.ledger.post` | ✓ | ✓ |
| `billing.gl_batch.export` | ✓ | ✗ |
| `billing.fiscal_period.close` / `.lock` / `.reopen` | – | ✓ |
| `billing.tax_config.create` | ✓ | ✓ |
| `billing.tax_exemption.apply` | ✓ | ✓ |
| `billing.comp.post` | ✓ | ✓ |
| `billing.no_show.charge` | ✓ | ✓ |
| `billing.late_checkout.charge` | ✓ | ✗ |
| `billing.cancellation.penalty` | ✓ | ✗ |
| `billing.chargeback.update_status` | ✓ | ✗ |
| `billing.express_checkout` | ✓ | ✓ |
| `billing.routing_rule.*` | – | ✓ |
| `group.create` / `group.check_in` | – | ✓ |
