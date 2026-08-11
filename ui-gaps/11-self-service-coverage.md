# COV-11: Guest Portal Uses 5 of 14 Self-Service Endpoints

**Priority:** P1 | **Risk:** 🟡 LOW-MEDIUM | **Type:** UI | **Effort:** M

> ## ✅ Shipped 2026-08-11 — all 9 endpoints now have a client
>
> `GuestApiService` gained methods for every previously unwired endpoint, and three surfaces use them:
>
> - **`pages/checkout/`** (new, route `/checkout`, header link) — folio preview then commit. The preview
>   is not skippable: a guest asked to confirm checkout without seeing the bill cannot dispute a charge
>   before it settles, which is why that endpoint exists. Keys are read alongside so the confirmation
>   can say they were released. **The portal does not take payment** — an outstanding balance is stated
>   and pointed at reception, because no self-service settlement path exists.
> - **`pages/rewards/`** (new, route `/rewards`, header link) — catalogue, redeem, history.
> - **`pages/checkin/`** — registration-card link on the Done step (the `/html` variant, opened rather
>   than fetched, since it is what a guest reads and signs) and `getCheckin()` for resume-after-refresh.
>
> **Constraint found while building, worth its own decision:** redemption requires a `guest_id`, and
> the portal has **no session** — a guest arrives with a confirmation code, not a login. The form asks
> for the guest id, which is honest but poor. `portalConfig` also hard-codes tenant and property. A real
> guest account model would replace both; until then the rewards flow is usable but not something to
> put in front of a paying guest.
>
> **Response shapes are read defensively.** Every display field on the new types is optional and each
> envelope is unwrapped (`data` / bare array), because these nine endpoints have never been exercised by
> a browser — the exact payloads are unverified.
>
> **Verified:** `ng build` clean for the portal on each step. **Not verified:** none of these calls has
> been made against a running service. The E2E suite covers `pms-ui`-side APIs, not the portal, so this
> needs a manual pass once the stack is up.
>
> Still deferred: staff-side `rooms.key.issue` / `.revoke` (COV-17) — a guest-visible key with no staff
> revoke path is a security gap, and shipping the guest half first makes that more pressing, not less.

## Current State (Backend ✅ → UI partial)

`Apps/guests-service` implements 14 `/v1/self-service` endpoints. `UI/guest-portal` calls 5, all
through `UI/guest-portal/src/app/services/guest-api.service.ts` (`baseUrl = "/v1/self-service"`).

### Wired

| Method | Path | Portal page |
|---|---|---|
| GET | `/search` | `pages/search` |
| POST | `/book` | `pages/booking` |
| GET | `/booking/:confirmationCode` | `pages/lookup` |
| POST | `/check-in/start` | `pages/checkin` |
| POST | `/check-in/:checkinId/complete` | `pages/checkin` |

### Not wired — 9 endpoints

| Method | Path | Route file |
|---|---|---|
| GET | `/check-in/:checkinId` | `routes/checkin.ts` |
| GET | `/check-out/preview` | `routes/checkout.ts` |
| POST | `/check-out` | `routes/checkout.ts` |
| GET | `/keys/:reservationId` | `routes/keys.ts` |
| GET | `/registration-card/:reservationId` | `routes/registration-card.ts` |
| GET | `/registration-card/:reservationId/html` | `routes/registration-card.ts` |
| GET | `/rewards` | `routes/rewards.ts` |
| POST | `/rewards/redeem` | `routes/rewards.ts` |
| GET | `/rewards/redemptions` | `routes/rewards.ts` |

The portal is therefore a **booking + arrival** product with no departure, no keys, and no loyalty —
the second half of the stay is missing even though the backend has it.

## Work Required

All UI-only. Grouped by user journey, in the order they pay off.

### 1. Mobile check-out (highest value)

- `pages/checkout` — call `GET /check-out/preview` to show the folio before committing: charges,
  taxes, payment method on file, balance.
- `POST /check-out` to complete; show confirmation and offer the invoice.
- Add the two methods to `guest-api.service.ts`.
- Express checkout already exists on the staff side (`billing.express_checkout`, UI-dispatched), so the
  billing behaviour is proven — this is the guest-facing entry to it.

### 2. Digital keys

- `pages/keys` (or a card on the confirmation/stay page) — `GET /keys/:reservationId`.
- Check what the endpoint returns before designing: a mobile-key token, a PIN, or a lock reference
  determines whether this is a QR code, a code display, or a deep link.
- Staff-side `rooms.key.issue` / `rooms.key.revoke` exist as commands but are not UI-reachable either
  (see COV-17) — a guest-visible key with no staff revoke path is a security gap. Ship revoke with it.

### 3. Registration card

- `GET /registration-card/:reservationId` (JSON) and `/html`. The HTML variant is meant to be
  displayed or printed — link it from the check-in flow so the guest can review and sign before
  arrival, which is the point of pre-arrival check-in.
- `reservation.generate_registration_card` is a live command with no UI trigger; check whether the
  card must be generated before the GET returns anything.

### 4. Rewards / loyalty

- `pages/rewards` — `GET /rewards` (balance, tier, available redemptions), `POST /rewards/redeem`,
  `GET /rewards/redemptions` (history).
- Staff-side loyalty is already wired in `pms-ui` (`features/loyalty`, `loyalty.program.enroll` and
  `loyalty.points.*` dispatched). Keep the tier and points model consistent with that screen — do not
  invent portal-only semantics.

### 5. Check-in status polling

- `GET /check-in/:checkinId` — the portal starts and completes a check-in but never reads its state.
  Needed for resume-after-refresh and for showing "awaiting document verification" style states.
  Small, and it fixes a real hole in the existing flow.

## Acceptance

- A guest can check out from the portal and see the folio first.
- Key, registration card and rewards are reachable from an active stay.
- Refreshing mid-check-in does not lose the session.

## Cross-reference

- [09-guest-feedback.md](09-guest-feedback.md) — proposes a `POST /v1/self-service/feedback` intake;
  the same portal service client will own it.
- [15-booking-engine-duplication.md](15-booking-engine-duplication.md) — `/v1/self-service/search|book`
  overlaps `/v1/direct-booking/*`; settle that before extending the booking path further.
- [17-command-reachability.md](17-command-reachability.md) — `rooms.key.issue` / `.revoke`.
