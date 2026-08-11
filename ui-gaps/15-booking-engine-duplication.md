# COV-15: Two Booking Engines — `/v1/direct-booking` vs `/v1/self-service`

**Priority:** P2 (decision) | **Risk:** 🟡 MEDIUM | **Type:** Decision | **Effort:** S

## Current State

Two independent guest-facing booking APIs in two services answering the same three questions.

| Concern | `/v1/direct-booking` (core-service) | `/v1/self-service` (guests-service) |
|---|---|---|
| Availability | `GET /v1/direct-booking/availability` | `GET /v1/self-service/search` |
| Price | `GET /v1/direct-booking/rate-quote` | (folded into search) |
| Book | `POST /v1/direct-booking/book` | `POST /v1/self-service/book` |
| Retrieve | — | `GET /v1/self-service/booking/:confirmationCode` |
| Check-in / out, keys, rewards, reg card | — | 11 more endpoints |
| UI | ❌ `direct-booking` does not occur in `UI/` | ✅ `UI/guest-portal` uses it |

Route files: `Apps/core-service/src/routes/direct-booking.ts` (+ `services/direct-booking-service.ts`),
`Apps/guests-service/src/routes/booking.ts`.

`/v1/self-service` is the one the product uses. `/v1/direct-booking` has no caller anywhere — not the
portal, not `pms-ui`.

## The Question

Was `direct-booking` meant to be the **white-label booking engine for a hotel's own website** (a
different consumer from the guest portal), or is it an earlier iteration that `self-service`
superseded?

The naming suggests the former; the absence of any consumer, and the fact that `self-service` covers
booking *plus* the entire stay lifecycle, suggests the latter.

## Options

**Option A — retire `direct-booking` (recommended unless there is a known external consumer).**
Delete the route file, its service, and the gateway exposure. `self-service` already does everything
it does and more, and it is the surface with a real client. One booking path means one place where
availability, rate quoting and inventory decrement can go wrong.

**Option B — keep it as the external/embeddable engine.** Then it needs: a documented external
contract, its own auth model (API key per property, not guest session), rate limiting, and CORS. None
of that exists today. It also needs `rate-quote` to agree with `self-service/search` pricing to the
cent — two pricing paths that disagree is a support nightmare, and nothing currently tests that they
agree.

**Option C — make `direct-booking` a thin facade over the same booking service as `self-service`.**
Preserves the external surface without a second implementation of availability and pricing. This is
the right answer if Option B's requirement is real: keep the URL, delete the duplicate logic.

## Work Required Before Deciding

1. Check whether the two paths share an availability implementation or each has its own. Both should be
   going through `availability-guard-service`; verify that neither bypasses it, because a booking path
   that skips the guard can oversell.
2. Compare the rate calculation in `direct-booking-service.ts` against the search/book path in
   `guests-service` — if they can produce different prices for the same stay, that is a defect
   independent of this decision and should be raised as one.
3. Grep `executables/`, `http_test/` and `loadtest/` for `direct-booking` callers.
4. Ask whether any customer integration is pointed at it.

## Acceptance

Decision recorded in this file with a date. If A: removed in one PR. If C: `direct-booking` delegates,
with a test asserting identical quotes from both paths for the same stay.

## Cross-reference

- [11-self-service-coverage.md](11-self-service-coverage.md) — do not extend the booking path further
  until this is settled.
- Same duplicate-surface pattern as [04-duplicate-ar-surface.md](04-duplicate-ar-surface.md),
  [07-lost-and-found.md](07-lost-and-found.md) and the cashier-sessions duplication noted in
  [12-billing-partials.md](12-billing-partials.md). See
  [18-write-path-gap.md](18-write-path-gap.md) for the full list.
