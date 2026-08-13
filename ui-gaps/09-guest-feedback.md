# COV-09: Guest Feedback — Read-Only, No UI

**Priority:** P1 | **Risk:** 🟡 MEDIUM | **Type:** Backend + UI | **Effort:** M

> ## ✅ Write path + staff UI shipped 2026-08-13 (portal intake still open)
>
> **Two things in the table made the spec's design impossible**, both fixed:
>
> 1. **`guest_id` and `reservation_id` were NOT NULL.** `STAFF_ENTERED` intake is a phone complaint
>    from someone who may not be in the system and may not map to one stay — the constraint forbade
>    exactly the case the feature exists for. Both are now nullable.
> 2. **There was no workflow at all.** The table had `response_text`/`responded_by`/`responded_at` and
>    nothing else — no status, no owner, no category, no resolution. Feedback with no owner and no
>    status is a table that fills up and is never worked. Added additively (`ADD COLUMN IF NOT EXISTS`)
>    to the canonical `43_guest_feedback.sql`: `feedback_status` (CHECK-constrained,
>    default `new`), `feedback_category`, `assigned_to`/`assigned_at`, `resolution_notes`,
>    `resolved_by`/`resolved_at`, `service_recovery_reference`.
>
> Four HTTP routes on core-service, per [18](18-write-path-gap.md)'s rule:
> `POST /v1/guest-feedback`, `PUT …/:feedbackId` (triage), `POST …/:feedbackId/respond`,
> `POST …/:feedbackId/resolve` — plus the bare `POST` at the gateway, and the list gaining
> `feedback_status` / `feedback_category` filters.
>
> Two transitions are deliberate rather than blind writes:
> - responding advances the status **only from a state that precedes it**, so answering something
>   already resolved does not reopen it;
> - assigning stamps `assigned_at` in the same statement, because an owner with no timestamp cannot
>   be aged.
>
> `service_recovery_reference` is on the resolve body so a goodwill spend is tied to the complaint
> that caused it rather than floating free on the folio (§3 item 4). It is a reference string today,
> not a `billing.comp.post` dispatch — wiring that is a follow-on.
>
> UI at `UI/pms-ui/src/app/features/guests/feedback/`, routed at `/guests/feedback` ahead of
> `guests/:guestId`, which would otherwise match `feedback` as an id.
>
> **Still open:** §2, the guest-portal intake endpoint. The portal is unauthenticated guest context and
> must not call `/v1/guest-feedback` directly, so this needs `POST /v1/self-service/feedback` fanning
> out to the same store — see [11](11-self-service-coverage.md). Until then feedback is staff-entered
> and OTA/survey-imported only. Also deferred: KPI tiles (§3.5), guest-profile integration (§3.6), and
> the `notification.automated.create` overlap check (§4).
>
> **Not yet exercised against a live stack**, and the new columns need
> `psql -f scripts/tables/03-bookings/43_guest_feedback.sql` run against an existing database.

## Current State (Backend ⚠️ read-only → UI ❌)

`Apps/core-service/src/routes/operations.ts`:

| Method | Path | Line |
|---|---|---|
| GET | `/v1/guest-feedback` | 557 |
| GET | `/v1/guest-feedback/:feedbackId` | 619 |

Gateway proxies at `Apps/api-gateway/src/routes/operations-routes.ts:140` (`GET` + `ALL /*`).
`guest-feedback` does not occur in `UI/`. No write path and no command handler.

## Why It Matters

Feedback with no intake and no response workflow is a table that stays empty. Two halves are missing:

- **Intake** — nothing can create a feedback record: not the guest portal, not staff on a phone
  complaint, not a post-stay survey.
- **Response loop** — no way to acknowledge, categorise, assign or resolve. Complaint handling is
  where feedback earns its keep.

## Work Required

### 1. Backend write path

Per COV-18, on core-service alongside the existing reads:

- `POST /v1/guest-feedback` — create, with a `source` discriminator: `GUEST_PORTAL`, `STAFF_ENTERED`,
  `SURVEY`, `OTA_REVIEW`, `EMAIL`
- `PUT /v1/guest-feedback/:feedbackId` — categorise, set sentiment/score, assign an owner
- `POST /v1/guest-feedback/:feedbackId/respond` — record the response sent to the guest
- `POST /v1/guest-feedback/:feedbackId/resolve` — close with a resolution and optional service-recovery
  reference

Read the two `GET` response shapes and the backing table first; extend that model rather than
introducing a parallel one.

### 2. Guest-facing intake (guest-portal)

The guest portal (`UI/guest-portal`) has pages for search, booking, confirmation, lookup and check-in
and talks only to `/v1/self-service` via `services/guest-api.service.ts`. A post-stay or in-stay
feedback form needs a `self-service` endpoint that fans out to the same store — otherwise feedback is
staff-entered only. Decide whether to expose
`POST /v1/self-service/feedback` or to let the portal call `/v1/guest-feedback` directly (it should
not — the portal is unauthenticated guest context).

### 3. UI — `UI/pms-ui/src/app/features/guests/feedback/`

1. **Inbox** — date, guest, reservation, source, category, sentiment/score, status, owner. Filters:
   unresolved, source, category, score band, date range.
2. **Detail** — full text, linked guest and stay, response history.
3. **Actions** — assign, categorise, respond, resolve.
4. **Service recovery** — link a resolution to a comp posting (`billing.comp.post` is live and
   already has budget tracking and authorisation) so a goodwill gesture is recorded against the
   complaint that caused it.
5. **KPI tiles** — response rate, median time to first response, score trend, top categories.
6. **Guest-detail integration** — feedback history on the guest profile, next to the existing
   communications tab.

### 4. Overlap check before building

`notification.*` (7 commands, all handled in notification-service, none UI-reachable — see COV-17)
covers templates and automated messages. A post-stay survey trigger likely belongs there rather than
as new machinery here. Check `notification.automated.create` before writing a scheduler.

## Acceptance

- Staff can log a complaint from a phone call and carry it to resolution in the product.
- A guest can submit feedback through the portal, and it lands in the same inbox.
- Feedback appears on the guest profile.

## Cross-reference

- [18-write-path-gap.md](18-write-path-gap.md) — blocking.
- [11-self-service-coverage.md](11-self-service-coverage.md) — the portal-side intake endpoint.
- [17-command-reachability.md](17-command-reachability.md) — `notification.*` reachability.
